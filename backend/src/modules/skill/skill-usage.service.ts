import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { SkillUsageRecord } from './skill.types';

const DEFAULT_USAGE_PATH = homedir() + '/.aniclaw/skills/.skill-usage.json';
const FLUSH_INTERVAL_MS = 60_000;

@Injectable()
export class SkillUsageService implements OnModuleInit, OnModuleDestroy {
  private usagePath = DEFAULT_USAGE_PATH;
  private data: Map<string, SkillUsageRecord> = new Map();
  private dirty = false;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  async onModuleInit() {
    await this.load();
    this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
  }

  private async load() {
    try {
      const raw = await readFile(this.usagePath, 'utf-8');
      const obj: Record<string, SkillUsageRecord> = JSON.parse(raw);
      for (const [k, v] of Object.entries(obj)) {
        this.data.set(k, v);
      }
    } catch {
      // 文件不存在
    }
  }

  private async flush() {
    if (!this.dirty) return;
    this.dirty = false;
    const dir = resolve(this.usagePath, '..');
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    const obj: Record<string, SkillUsageRecord> = {};
    for (const [k, v] of this.data) obj[k] = v;
    const tmp = this.usagePath + '.tmp';
    await writeFile(tmp, JSON.stringify(obj, null, 2), 'utf-8');
    await rename(tmp, this.usagePath);
  }

  private ensure(skillId: string): SkillUsageRecord {
    let record = this.data.get(skillId);
    if (!record) {
      record = {
        useCount: 0,
        viewCount: 0,
        patchCount: 0,
        lastUsedAt: null,
        createdAt: new Date().toISOString(),
      };
      this.data.set(skillId, record);
    }
    return record;
  }

  /** lookup_skill 调用时触发 */
  trackUse(skillId: string) {
    const r = this.ensure(skillId);
    r.useCount++;
    r.lastUsedAt = new Date().toISOString();
    this.dirty = true;
  }

  /** findOneSummary 调用时触发 */
  trackView(skillId: string) {
    const r = this.ensure(skillId);
    r.viewCount++;
    this.dirty = true;
  }

  /** update_skill 审批通过时触发 */
  trackPatch(skillId: string) {
    const r = this.ensure(skillId);
    r.patchCount++;
    r.lastUsedAt = new Date().toISOString();
    this.dirty = true;
  }

  /** 获取单个 Skill 的使用统计 */
  getUsage(skillId: string): SkillUsageRecord | null {
    return this.data.get(skillId) ?? null;
  }

  /** 获取所有统计 */
  getAllUsage(): Record<string, SkillUsageRecord> {
    const obj: Record<string, SkillUsageRecord> = {};
    for (const [k, v] of this.data) obj[k] = v;
    return obj;
  }

  async onModuleDestroy() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    await this.flush();
  }
}
