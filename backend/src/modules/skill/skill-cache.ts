import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { homedir } from 'node:os';

interface CacheEntry {
  content: string;
  expiry: number;
}

interface ManifestEntry {
  mtime: string;
  size: number;
  hash: string;
}

const DEFAULT_CACHE_DIR = homedir() + '/.aniclaw/skills';
const MANIFEST_FILE = '.cache-manifest.json';
const MAX_LRU_SIZE = 50;
const TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * 二层缓存：L1 内存 LRU + L2 磁盘 manifest（mtime/size 校验）
 *
 * L1 用于热点 skill instructions 的快速读取，避免重复返回内存对象。
 * L2 manifest 记录文件指纹，未来可用于跳过未变化的 SKILL.md 重新解析。
 */
export class SkillCache {
  private lru = new Map<string, CacheEntry>();
  private manifestPath: string;
  private manifest = new Map<string, ManifestEntry>();
  private loaded = false;

  constructor(baseDir: string = DEFAULT_CACHE_DIR) {
    this.manifestPath = resolve(baseDir, MANIFEST_FILE);
  }

  /** L1: 内存 LRU get */
  get(key: string): string | null {
    const entry = this.lru.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      this.lru.delete(key);
      return null;
    }
    // LRU: delete + re-insert to move to end
    this.lru.delete(key);
    this.lru.set(key, entry);
    return entry.content;
  }

  /** L1: 内存 LRU set */
  set(key: string, content: string): void {
    // Evict oldest if at capacity
    if (this.lru.size >= MAX_LRU_SIZE && !this.lru.has(key)) {
      const firstKey = this.lru.keys().next().value;
      if (firstKey) this.lru.delete(firstKey);
    }
    this.lru.set(key, { content, expiry: Date.now() + TTL_MS });
  }

  /** Invalidate a single key */
  invalidate(key: string): void {
    this.lru.delete(key);
    this.manifest.delete(key);
  }

  /** Invalidate all */
  invalidateAll(): void {
    this.lru.clear();
    this.manifest.clear();
  }

  /** L2: Load disk manifest */
  async loadManifest(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.manifestPath, 'utf-8');
      const obj: Record<string, ManifestEntry> = JSON.parse(raw);
      for (const [k, v] of Object.entries(obj)) {
        this.manifest.set(k, v);
      }
    } catch {
      // 文件不存在，首次启动
    }
    this.loaded = true;
  }

  /** L2: Save disk manifest（atomic write via rename） */
  async saveManifest(): Promise<void> {
    const dir = resolve(this.manifestPath, '..');
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    const obj: Record<string, ManifestEntry> = {};
    for (const [k, v] of this.manifest) obj[k] = v;
    const tmp = this.manifestPath + '.tmp';
    await writeFile(tmp, JSON.stringify(obj, null, 2), 'utf-8');
    await rename(tmp, this.manifestPath);
  }

  /** 检查文件是否与 manifest 匹配（mtime + size 未变） */
  async isUnchanged(skillId: string, filePath: string): Promise<boolean> {
    const cached = this.manifest.get(skillId);
    if (!cached) return false;

    try {
      const stats = await stat(filePath);
      return (
        stats.mtime.toISOString() === cached.mtime &&
        stats.size === cached.size
      );
    } catch {
      return false;
    }
  }

  /** 更新 manifest 中的文件指纹条目 */
  async updateEntry(skillId: string, filePath: string): Promise<void> {
    try {
      const stats = await stat(filePath);
      const content = await readFile(filePath, 'utf-8');
      const hash = createHash('sha256').update(content).digest('hex').slice(0, 16);
      this.manifest.set(skillId, {
        mtime: stats.mtime.toISOString(),
        size: stats.size,
        hash,
      });
    } catch {
      // 文件不存在，移除条目
      this.manifest.delete(skillId);
    }
  }
}
