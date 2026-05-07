import { Injectable, OnModuleInit, Inject, forwardRef, Optional } from '@nestjs/common';
import { Skill, scanSkillsDir, DEFAULT_SKILLS_DIR } from './skill.types';
import { SettingsService } from '../settings/settings.service';
import { SkillUsageService } from './skill-usage.service';
import { SkillExperienceService } from './skill-experience.service';
import { SkillCuratorService } from './skill-curator.service';
import { SkillCache } from './skill-cache';
import { filterActiveSkills } from './skill-filter';
import { resolve } from 'node:path';
import { rm } from 'node:fs/promises';
import { homedir } from 'node:os';

function escapeXml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** 路径压缩：将 home 目录替换为 ~ */
function compactHomePath(filePath: string): string {
  const home = homedir();
  if (filePath.startsWith(home + '/')) {
    return '~' + filePath.slice(home.length);
  }
  return filePath;
}

/** Skill 索引字符预算上限 */
const MAX_SKILL_INDEX_CHARS = 18000;

@Injectable()
export class SkillService implements OnModuleInit {
  private skills: Skill[] = [];
  private cachedIndex = '';
  private cache = new SkillCache();

  constructor(
    @Inject(forwardRef(() => SettingsService))
    private settingsService: SettingsService,
    private readonly usageService: SkillUsageService,
    private readonly experienceService: SkillExperienceService,
    @Optional() private readonly curatorService: SkillCuratorService | null,
  ) {}

  async onModuleInit() {
    await this.cache.loadManifest();
    await this.refresh();
  }

  private async getSkillsDirs(): Promise<string[]> {
    const configured = await this.settingsService.getValue('skills_dirs').catch(() => '');
    if (configured) return configured.split(',').map(d => resolve(d.trim())).filter(Boolean);
    return [DEFAULT_SKILLS_DIR];
  }

  /** 重新扫描所有目录（多源优先级：后者覆盖前者同名 skill） */
  async refresh(): Promise<void> {
    const dirs = await this.getSkillsDirs();
    // 使用 Map 实现优先级合并：后扫描的目录覆盖先扫描的
    const merged = new Map<string, Skill>();
    for (const dir of dirs) {
      for (const skill of scanSkillsDir(dir)) {
        merged.set(skill.id, skill);
      }
    }
    // 确定性排序
    this.skills = Array.from(merged.values())
      .sort((a, b) => a.name.localeCompare(b.name, 'en'));
    this.cachedIndex = '';
    this.cache.invalidateAll();
    await this.cache.saveManifest();
  }

  private findById(id: string): Skill | undefined {
    return this.skills.find(s => s.id === id);
  }

  /** 列表（metadata only，progressive disclosure stage 1） */
  async findAllSummary() {
    return this.skills.map(({ id, name, description, license, compatibility, aliases, active }) => ({
      id, name, description, license, compatibility, aliases, active,
    }));
  }

  /** 详情（含 instructions，stage 2） */
  async findOneSummary(id: string) {
    const s = this.findById(id);
    if (!s) return undefined;
    this.usageService.trackView(id);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { dirPath, source, ...rest } = s;
    return rest;
  }

  /** 供 lookup_skill 工具调用（L1 缓存） */
  async findSkillForLookup(id: string): Promise<{ instructions: string; dirPath: string } | null> {
    const s = this.findById(id);
    if (!s) return null;
    this.usageService.trackUse(id);

    const cached = this.cache.get(id);
    if (cached) {
      return { instructions: cached, dirPath: s.dirPath };
    }

    this.cache.set(id, s.instructions);
    return { instructions: s.instructions, dirPath: s.dirPath };
  }

  /** 构建全局 skill 索引（缓存，refresh 时清除），带 Token 预算管理 + 条件激活 */
  async buildSkillIndex(availableToolNames?: Set<string>): Promise<string> {
    if (this.cachedIndex) return this.cachedIndex;
    if (this.skills.length === 0) return '';

    const curator = this.curatorService;
    const nonArchived = curator
      ? this.skills.filter(s => curator.getLifecycleState(s.id) !== 'archived')
      : this.skills;

    if (nonArchived.length === 0) return '';

    // 条件激活过滤
    const activeSkills = availableToolNames
      ? filterActiveSkills(nonArchived, availableToolNames)
      : nonArchived;

    if (activeSkills.length === 0) return '';

    const entries = activeSkills.map(s => {
      const location = compactHomePath(s.dirPath);
      return `  <skill>\n    <name>${escapeXml(s.name)}</name>\n    <description>${escapeXml(s.description)}</description>\n    <location>${escapeXml(location)}</location>\n  </skill>`;
    });

    const header = '<available_skills>';
    const footer = `</available_skills>\n\nUse the lookup_skill tool to load a skill's full instructions when the task matches its description.\nUse the read_skill_reference tool to read referenced files within a skill's directory.`;
    const separator = '\n';

    let index = `${header}\n${entries.join(separator)}\n${footer}`;
    if (index.length > MAX_SKILL_INDEX_CHARS) {
      const compactEntries = activeSkills.map(s =>
        `  <skill>\n    <name>${escapeXml(s.name)}</name>\n  </skill>`
      );
      index = `${header}\n${compactEntries.join(separator)}\n${footer}`;
    }

    this.cachedIndex = index;
    return this.cachedIndex;
  }

  async getUsage(skillId: string) {
    return this.usageService.getUsage(skillId);
  }

  /** 删除 skill（移除目录） */
  async delete(id: string): Promise<boolean> {
    const s = this.findById(id);
    if (!s) return false;
    try {
      await rm(s.dirPath, { recursive: true, force: true });
      this.skills = this.skills.filter(sk => sk.id !== id);
      this.cache.invalidate(id);
      this.cachedIndex = '';
      return true;
    } catch {
      return false;
    }
  }

  /** 记录 Skill 使用经验 */
  async recordExperience(params: {
    skillId: string;
    conversationId: string;
    outcome: 'success' | 'failure' | 'partial';
    failureReason?: string;
    userFeedback?: string;
  }) {
    this.experienceService.record(params);
  }

  /** 获取 Skill 经验统计 */
  async getExperienceSummary() {
    return this.experienceService.getExperienceSummary();
  }

  /** 检查是否应建议 Patch */
  async shouldSuggestPatch(skillId: string): Promise<boolean> {
    return this.experienceService.shouldSuggestPatch(skillId);
  }

  /** 生成 Skill Patch 建议（供 Agent prompt 注入） */
  async buildPatchSuggestions(): Promise<string> {
    const summary = this.experienceService.getExperienceSummary();
    const suggestions: string[] = [];

    for (const [skillId, stats] of Object.entries(summary)) {
      if (this.experienceService.shouldSuggestPatch(skillId)) {
        const failures = this.experienceService.getRecentFailures(skillId, 3);
        const reasons = failures
          .map(f => f.failureReason || '未知原因')
          .join('; ');
        suggestions.push(
          `Skill "${skillId}" 已累计 ${stats.failure} 次失败经验。最近失败原因: ${reasons}。建议使用 update_skill 改进此 Skill。`,
        );
      }
    }

    if (suggestions.length === 0) return '';
    return '<skill_patch_suggestions>\n' + suggestions.join('\n') + '\n</skill_patch_suggestions>';
  }
}
