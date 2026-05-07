import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { readFile, writeFile, mkdir, rename, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { SkillLifecycleState, LifecycleRecord } from './skill.types';
import { SkillUsageService } from './skill-usage.service';
import { SkillService } from './skill.service';

const DEFAULT_LIFECYCLE_PATH = homedir() + '/.aniclaw/skills/.skill-lifecycle.json';
const STALE_THRESHOLD_DAYS = 30;
const ARCHIVE_THRESHOLD_DAYS = 30;
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

@Injectable()
export class SkillCuratorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SkillCuratorService.name);
  private lifecyclePath = DEFAULT_LIFECYCLE_PATH;
  private data: Map<string, LifecycleRecord> = new Map();
  private dirty = false;
  private checkTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly usageService: SkillUsageService,
    private readonly skillService: SkillService,
  ) {}

  async onModuleInit() {
    await this.load();
    this.checkTimer = setInterval(() => this.runCheck(), CHECK_INTERVAL_MS);
    // 启动时延迟 5 分钟执行首次检查，避免影响启动性能
    setTimeout(() => this.runCheck(), 5 * 60 * 1000);
  }

  async onModuleDestroy() {
    if (this.checkTimer) clearInterval(this.checkTimer);
    await this.flush();
  }

  private async load() {
    try {
      const raw = await readFile(this.lifecyclePath, 'utf-8');
      const obj: Record<string, LifecycleRecord> = JSON.parse(raw);
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
    const dir = resolve(this.lifecyclePath, '..');
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    const obj: Record<string, LifecycleRecord> = {};
    for (const [k, v] of this.data) obj[k] = v;
    const tmp = this.lifecyclePath + '.tmp';
    await writeFile(tmp, JSON.stringify(obj, null, 2), 'utf-8');
    await rename(tmp, this.lifecyclePath);
  }

  private ensure(skillId: string): LifecycleRecord {
    let record = this.data.get(skillId);
    if (!record) {
      record = { state: 'active', staleAt: null, archivedAt: null };
      this.data.set(skillId, record);
    }
    return record;
  }

  /** 获取单个 Skill 的生命周期状态 */
  getLifecycleState(skillId: string): SkillLifecycleState {
    return this.ensure(skillId).state;
  }

  /** 获取所有 Skill 的生命周期状态 */
  getAllLifecycleStates(): Record<string, LifecycleRecord> {
    const obj: Record<string, LifecycleRecord> = {};
    for (const [k, v] of this.data) obj[k] = v;
    return obj;
  }

  /** 获取指定状态的所有 Skill ID */
  getSkillsByState(state: SkillLifecycleState): string[] {
    const result: string[] = [];
    for (const [id, record] of this.data) {
      if (record.state === state) result.push(id);
    }
    return result;
  }

  /** 手动设置 Skill 生命周期状态 */
  async setLifecycleState(skillId: string, state: SkillLifecycleState): Promise<void> {
    const record = this.ensure(skillId);
    const now = new Date().toISOString();

    if (state === 'stale' && record.state === 'active') {
      record.state = 'stale';
      record.staleAt = now;
    } else if (state === 'archived' && record.state === 'stale') {
      record.state = 'archived';
      record.archivedAt = now;
    } else if (state === 'active') {
      // 恢复：从 stale/archived 回到 active
      record.state = 'active';
      record.staleAt = null;
      record.archivedAt = null;
    }

    this.dirty = true;
    await this.flush();
  }

  /** 执行生命周期检查（定时调用） */
  async runCheck(): Promise<{ stale: string[]; archived: string[] }> {
    const allUsage = this.usageService.getAllUsage();
    const allSkills = await this.skillService.findAllSummary();
    const now = Date.now();

    const staleNew: string[] = [];
    const archivedNew: string[] = [];

    for (const skill of allSkills) {
      const record = this.ensure(skill.id);
      if (record.state !== 'active' && record.state !== 'stale') continue;

      const usage = allUsage[skill.id];
      const lastUsed = usage?.lastUsedAt ? new Date(usage.lastUsedAt).getTime() : null;
      const created = usage?.createdAt ? new Date(usage.createdAt).getTime() : now;
      const referenceTime = lastUsed || created;

      if (record.state === 'active') {
        const daysSinceUse = (now - referenceTime) / (24 * 60 * 60 * 1000);
        if (daysSinceUse >= STALE_THRESHOLD_DAYS) {
          record.state = 'stale';
          record.staleAt = new Date().toISOString();
          staleNew.push(skill.id);
          this.dirty = true;
        }
      }

      if (record.state === 'stale' && record.staleAt) {
        const daysSinceStale = (now - new Date(record.staleAt).getTime()) / (24 * 60 * 60 * 1000);
        if (daysSinceStale >= ARCHIVE_THRESHOLD_DAYS) {
          record.state = 'archived';
          record.archivedAt = new Date().toISOString();
          archivedNew.push(skill.id);
          this.dirty = true;
        }
      }
    }

    if (this.dirty) {
      await this.flush();
      // 归档的 Skill 从索引中排除（通过 refresh 重建）
      if (archivedNew.length > 0) {
        await this.skillService.refresh();
      }
    }

    if (staleNew.length > 0) {
      this.logger.log(`生命周期检查: ${staleNew.join(', ')} 已标记为 stale`);
    }
    if (archivedNew.length > 0) {
      this.logger.log(`生命周期检查: ${archivedNew.join(', ')} 已归档`);
    }

    return { stale: staleNew, archived: archivedNew };
  }

  /** 恢复已归档的 Skill */
  async restore(skillId: string): Promise<boolean> {
    const record = this.data.get(skillId);
    if (!record || record.state !== 'archived') return false;

    record.state = 'active';
    record.staleAt = null;
    record.archivedAt = null;
    this.dirty = true;
    await this.flush();
    await this.skillService.refresh();
    return true;
  }

  /** 彻底删除已归档的 Skill */
  async purgeArchived(skillId: string): Promise<boolean> {
    const record = this.data.get(skillId);
    if (!record || record.state !== 'archived') return false;

    const deleted = await this.skillService.delete(skillId);
    if (deleted) {
      this.data.delete(skillId);
      this.dirty = true;
      await this.flush();
    }
    return deleted;
  }
}
