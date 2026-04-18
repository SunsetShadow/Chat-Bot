import { z } from 'zod';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { safeTool } from '../base/tool.helper';
import { PathSandbox } from '../base/path-sandbox';

const MAX_RESULTS = 20;
const MAX_CONTENT_LENGTH = 50000;
const MAX_DEPTH = 10;

function globToRegex(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${escaped}$`, 'i');
}

async function walkDir(
  dir: string,
  opts: {
    fileNamePattern?: RegExp;
    contentPattern?: RegExp;
    recursive: boolean;
    maxResults: number;
    results: string[];
    depth: number;
    sandbox: PathSandbox;
  },
): Promise<void> {
  if (opts.results.length >= opts.maxResults || opts.depth > MAX_DEPTH) return;

  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (opts.results.length >= opts.maxResults) break;
    if (entry.name.startsWith('.')) continue;

    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (opts.recursive) {
        await walkDir(fullPath, { ...opts, depth: opts.depth + 1 });
      }
    } else if (entry.isFile()) {
      if (opts.fileNamePattern && !opts.fileNamePattern.test(entry.name)) continue;

      if (opts.contentPattern) {
        try {
          const fileStat = await stat(fullPath);
          if (fileStat.size > MAX_CONTENT_LENGTH) continue;
          const content = await readFile(fullPath, 'utf-8');
          if (!opts.contentPattern.test(content)) continue;

          const lines = content.split('\n');
          const matches: string[] = [];
          for (let i = 0; i < lines.length && matches.length < 3; i++) {
            if (opts.contentPattern.test(lines[i])) {
              matches.push(`  L${i + 1}: ${lines[i].trim()}`);
            }
            opts.contentPattern.lastIndex = 0;
          }
          opts.results.push(`${fullPath}\n${matches.join('\n')}`);
        } catch {
          continue;
        }
      } else {
        opts.results.push(fullPath);
      }
    }
  }
}

export function createSearchFilesTool(sandbox: PathSandbox) {
  return safeTool(
    'search_files',
    `搜索文件系统中的文件，支持按文件名或内容搜索。

何时使用：
- 用户要求"查找文件"、"搜索包含 xxx 的文件"、"找到 xxx 文件"
- 需要在目录中定位特定文件
- 需要在文件内容中搜索关键词或代码片段

注意：
- 支持通配符搜索文件名（* 匹配任意字符，? 匹配单个字符）
- 内容搜索使用正则表达式
- 仅在允许的目录范围内搜索`,
    z.object({
      directory: z.string().optional().describe('搜索的起始目录，默认为当前工作目录'),
      fileName: z.string().optional().describe('文件名匹配模式，支持 * 和 ? 通配符'),
      content: z.string().optional().describe('在文件内容中搜索的文本或正则表达式'),
      recursive: z.boolean().optional().describe('是否递归搜索子目录，默认 true'),
    }),
    async ({ directory, fileName, content, recursive }) => {
      const searchDir = sandbox.validate(directory || process.cwd());

      const fileNamePattern = fileName ? globToRegex(fileName) : undefined;
      let contentPattern: RegExp | undefined;
      if (content) {
        try {
          contentPattern = new RegExp(content, 'i');
        } catch {
          return `内容搜索模式无效：${content} 不是合法的正则表达式`;
        }
      }

      if (!fileNamePattern && !contentPattern) {
        return '请提供 fileName 或 content 参数中的至少一个';
      }

      const results: string[] = [];
      await walkDir(searchDir, {
        fileNamePattern,
        contentPattern,
        recursive: recursive !== false,
        maxResults: MAX_RESULTS,
        results,
        depth: 0,
        sandbox,
      });

      if (results.length === 0) {
        return `在 ${searchDir} 中未找到匹配的文件。`;
      }

      const header = contentPattern
        ? `在 ${searchDir} 中找到 ${results.length} 个包含匹配内容的文件（最多 ${MAX_RESULTS} 个）：`
        : `在 ${searchDir} 中找到 ${results.length} 个匹配的文件（最多 ${MAX_RESULTS} 个）：`;

      return `${header}\n\n${results.join('\n\n')}`;
    },
  );
}
