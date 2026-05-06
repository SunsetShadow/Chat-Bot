import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { SkillExperience } from './skill.types';

const DEFAULT_PATH = homedir() + '/.aniclaw/skills/.skill-experience.json';
const MAX_RECORDS = 1000;
const FLUSH_INTERVAL_MS = 60_000;

@Injectable()
export class SkillExperienceService implements OnModuleInit, OnModuleDestroy {
  private experiencePath = DEFAULT_PATH;
  private records: SkillExperience[] = [];
  private dirty = false;
  private flushTimer: ReturnType<typeof setInterval> | null = null;

  async onModuleInit() {
    await this.load();
    this.flushTimer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
  }

  private async load() {
    try {
      const raw = await readFile(this.experiencePath, 'utf-8');
      this.records = JSON.parse(raw);
    } catch {
      this.records = [];
    }
  }

  private async flush() {
    if (!this.dirty) return;
    this.dirty = false;
    const dir = resolve(this.experiencePath, '..');
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    const tmp = this.experiencePath + '.tmp';
    await writeFile(tmp, JSON.stringify(this.records, null, 2), 'utf-8');
    await rename(tmp, this.experiencePath);
  }

  /** 记录一次 Skill 使用经验 */
  record(experience: Omit<SkillExperience, 'timestamp'>): void {
    const record: SkillExperience = {
      ...experience,
      timestamp: new Date().toISOString(),
    };
    this.records.push(record);
    // 保留最近 MAX_RECORDS 条
    if (this.records.length > MAX_RECORDS) {
      this.records = this.records.slice(-MAX_RECORDS);
    }
    this.dirty = true;
  }

  /** 获取某个 Skill 的所有经验记录 */
  getExperience(skillId: string): SkillExperience[] {
    return this.records.filter(r => r.skillId === skillId);
  }

  /** 获取某个 Skill 的失败经验次数 */
  getFailureCount(skillId: string): number {
    return this.records.filter(r => r.skillId === skillId && r.outcome === 'failure').length;
  }

  /** 获取某个 Skill 最近 N 条失败记录 */
  getRecentFailures(skillId: string, limit = 5): SkillExperience[] {
    return this.records
      .filter(r => r.skillId === skillId && r.outcome === 'failure')
      .slice(-limit);
  }

  /** 检查某个 Skill 是否达到自动 Patch 阈值 */
  shouldSuggestPatch(skillId: string, threshold = 3): boolean {
    return this.getFailureCount(skillId) >= threshold;
  }

  /** 获取所有 Skill 的经验统计摘要 */
  getExperienceSummary(): Record<string, { success: number; failure: number; partial: number }> {
    const summary: Record<string, { success: number; failure: number; partial: number }> = {};
    for (const r of this.records) {
      if (!summary[r.skillId]) {
        summary[r.skillId] = { success: 0, failure: 0, partial: 0 };
      }
      summary[r.skillId][r.outcome]++;
    }
    return summary;
  }

  async onModuleDestroy() {
    if (this.flushTimer) clearInterval(this.flushTimer);
    await this.flush();
  }
}
