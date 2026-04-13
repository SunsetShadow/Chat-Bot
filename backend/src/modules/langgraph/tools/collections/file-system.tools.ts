import { z } from 'zod';
import fs from 'node:fs/promises';
import path from 'node:path';
import { safeTool } from '../base/tool.helper';

/**
 * 创建读取文件工具
 */
export function createReadFileTool() {
  return safeTool(
    'read_file',
    `读取指定路径的文件内容。

何时使用：
- 用户要求查看某个文件的内容
- 需要读取配置文件、代码文件、日志文件等
- 用户说"打开文件"、"读一下 xxx"、"看看 xxx 的内容"

注意：
- 大文件可能被截断，建议先确认文件大小
- 二进制文件无法正确显示`,
    z.object({
      filePath: z.string().describe('文件路径，可以是相对路径或绝对路径'),
    }),
    async ({ filePath }) => {
      const content = await fs.readFile(filePath, 'utf-8');
      // 限制输出长度，避免超出上下文
      if (content.length > 50000) {
        return `文件内容过长（${content.length} 字符），仅显示前 50000 字符:\n\n${content.slice(0, 50000)}\n\n... (已截断)`;
      }
      return content;
    },
  );
}

/**
 * 创建写入文件工具
 */
export function createWriteFileTool() {
  return safeTool(
    'write_file',
    `将内容写入指定路径的文件。

何时使用：
- 用户要求创建或修改文件
- 需要保存配置、代码、文档等
- 用户说"写入"、"保存到"、"创建文件"

注意：
- 会自动创建不存在的目录
- 如果文件已存在，会覆盖原有内容
- 请确保写入内容完整正确`,
    z.object({
      filePath: z.string().describe('文件路径'),
      content: z.string().describe('要写入的内容'),
    }),
    async ({ filePath, content }) => {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
      return `文件已写入: ${filePath}（${content.length} 字符）`;
    },
  );
}

/**
 * 创建列出目录工具
 */
export function createListDirectoryTool() {
  return safeTool(
    'list_directory',
    `列出指定目录下的文件和子目录。

何时使用：
- 用户要求查看目录结构
- 需要了解某个目录下有哪些文件
- 用户说"看看目录"、"列出文件"、"有什么文件"

注意：
- 仅列出直接子项，不递归深入子目录`,
    z.object({
      dirPath: z.string().describe('目录路径，默认当前目录'),
    }),
    async ({ dirPath }) => {
      const targetPath = dirPath || process.cwd();
      const entries = await fs.readdir(targetPath, { withFileTypes: true });

      if (entries.length === 0) return `目录 ${targetPath} 为空。`;

      const dirs = entries.filter((e) => e.isDirectory()).map((e) => `📁 ${e.name}/`);
      const files = entries.filter((e) => e.isFile()).map((e) => `📄 ${e.name}`);

      const parts: string[] = [`目录 ${targetPath}:`];
      if (dirs.length) parts.push(`\n目录 (${dirs.length}):\n${dirs.join('\n')}`);
      if (files.length) parts.push(`\n文件 (${files.length}):\n${files.join('\n')}`);

      return parts.join('');
    },
  );
}
