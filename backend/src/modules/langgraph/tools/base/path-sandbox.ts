import path from 'node:path';
import { readdir } from 'node:fs/promises';

const BLOCKED_PREFIXES = [
  '/etc', '/usr', '/bin', '/sbin', '/boot', '/proc', '/sys', '/dev',
  '/var/log', '/var/run',
  '/System', '/Library',
];

const BLOCKED_PATTERNS = [
  /\.env$/i,
  /id_rsa/i, /id_ed25519/i, /id_ecdsa/i,
  /\.pem$/i, /\.key$/i,
  /\.htpasswd$/i, /\.htaccess$/i,
  /shadow$/, /passwd$/,
  /credentials/i, /secret/i,
];

export class PathSandbox {
  private allowedDirs: string[];

  constructor(allowedDirs: string[]) {
    this.allowedDirs = allowedDirs.map(d => path.resolve(d));
  }

  updateAllowedDirs(dirs: string[]) {
    this.allowedDirs = dirs.map(d => path.resolve(d));
  }

  validate(rawPath: string): string {
    const resolved = path.resolve(rawPath);
    const normalized = resolved.replace(/\\/g, '/');

    for (const prefix of BLOCKED_PREFIXES) {
      if (normalized.startsWith(prefix + '/') || normalized === prefix) {
        throw new Error(`路径访问被拒绝：不允许访问 ${prefix} 目录`);
      }
    }

    const fileName = path.basename(resolved);
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(fileName)) {
        throw new Error(`路径访问被拒绝：敏感文件 ${fileName} 不允许访问`);
      }
    }

    const isAllowed = this.allowedDirs.some(dir =>
      normalized === dir || normalized.startsWith(dir + '/'),
    );

    if (!isAllowed) {
      throw new Error(`路径访问被拒绝：${normalized} 不在允许的目录范围内`);
    }

    return resolved;
  }

  isAllowed(rawPath: string): boolean {
    const resolved = path.resolve(rawPath);
    const normalized = resolved.replace(/\\/g, '/');
    return this.allowedDirs.some(dir =>
      normalized === dir || normalized.startsWith(dir + '/'),
    );
  }

  async listDirs(dirPath: string): Promise<string[]> {
    const safePath = this.validate(dirPath);
    const entries = await readdir(safePath, { withFileTypes: true });
    return entries
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort();
  }
}
