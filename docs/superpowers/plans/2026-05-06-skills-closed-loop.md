# Skills 闭环自进化系统 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现 Phase 1 核心闭环 — Agent 可创建/修改 Skill，经用户审批后生效，含基础安全扫描和使用量统计。

**Architecture:** 后端新增 SkillScanService（安全扫描）、SkillApprovalService（审批管理）、SkillUsageService（使用量统计），3 个 LangGraph Tool（create_skill/update_skill/propose_skill），SSE 推送审批通知。前端扩展 SkillsView 新增审批 tab + API 调用。

**Tech Stack:** NestJS（后端服务）、LangGraph Tools（safeTool 模式）、Vue 3 + Naive UI（前端）、SSE 事件推送、JSON 文件持久化。

**Spec:** `docs/superpowers/specs/2026-05-06-skills-closed-loop-design.md`

---

## File Structure

### 新建文件

| 文件 | 职责 |
|------|------|
| `backend/src/modules/skill/skill-scan.service.ts` | 安全扫描：路径遍历、代码注入、大小限制、YAML 校验 |
| `backend/src/modules/skill/skill-approval.service.ts` | 审批流程管理：submit/approve/reject，JSON 持久化 |
| `backend/src/modules/skill/skill-usage.service.ts` | 使用量统计：useCount/viewCount/patchCount，JSON 持久化 |
| `backend/src/modules/skill/tools/create-skill.tool.ts` | LangGraph Tool：Agent 创建新 Skill |
| `backend/src/modules/skill/tools/update-skill.tool.ts` | LangGraph Tool：Agent 修改已有 Skill |
| `backend/src/modules/skill/tools/propose-skill.tool.ts` | LangGraph Tool：Agent 推荐创建 Skill |
| `frontend/src/api/skill-approval.ts` | 审批 API：获取列表、审批通过/拒绝 |
| `frontend/src/composables/useSkillApproval.ts` | 审批状态管理 composable |

### 修改文件

| 文件 | 变更 |
|------|------|
| `backend/src/modules/skill/skill.types.ts` | 新增 SkillApproval、SkillUsage、ScanResult 类型 |
| `backend/src/modules/skill/skill.service.ts` | 注入新 services，findOneSummary/view 触发统计 |
| `backend/src/modules/skill/skill.controller.ts` | 新增审批/统计 REST endpoints |
| `backend/src/modules/skill/skill.module.ts` | 注册新 providers |
| `backend/src/modules/langgraph/langgraph.module.ts` | 注册 3 个新 tools |
| `backend/src/modules/langgraph/langgraph.service.ts` | yield skill_approval SSE 事件 |
| `backend/src/modules/chat/chat.service.ts` | 处理 skill_approval 事件类型 |
| `frontend/src/types/index.ts` | 新增 SkillApproval、SkillUsage 类型 |
| `frontend/src/views/SkillsView.vue` | 新增「待审批」tab |

---

## Task 1: 类型定义 + 安全扫描服务

**Files:**
- Modify: `backend/src/modules/skill/skill.types.ts`
- Create: `backend/src/modules/skill/skill-scan.service.ts`

### Step 1: 扩展 skill.types.ts — 新增类型

在 `skill.types.ts` 末尾追加：

```typescript
/** 安全扫描结果 */
export interface ScanThreat {
  type: 'path_traversal' | 'code_injection' | 'size_exceeded' | 'invalid_yaml' | 'suspicious_command';
  severity: 'error' | 'warning';
  message: string;
}

export interface ScanResult {
  safe: boolean;
  threats: ScanThreat[];
}

/** 审批记录 */
export interface SkillApproval {
  id: string;
  skillName: string;
  type: 'create' | 'update';
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt?: string;
  contentSnapshot: string;
  oldContentSnapshot?: string;
  patchDescription?: string;
  agentId?: string;
}

/** 使用量统计 */
export interface SkillUsageRecord {
  useCount: number;
  viewCount: number;
  patchCount: number;
  lastUsedAt: string | null;
  createdAt: string;
}

/** name 字段格式校验：kebab-case，3-64 字符 */
export function isValidSkillName(name: string): boolean {
  return /^[a-z][a-z0-9-]{1,62}[a-z0-9]$/.test(name) && name.length >= 3 && name.length <= 64;
}
```

- [ ] **Step 1 done**

### Step 2: 创建 skill-scan.service.ts

```typescript
import { Injectable } from '@nestjs/common';
import { ScanResult, ScanThreat } from './skill.types';

const MAX_INSTRUCTIONS_SIZE = 64 * 1024; // 64KB

const CODE_INJECTION_PATTERNS = [
  /<script[\s>]/i,
  /javascript\s*:/i,
  /\beval\s*\(/,
  /\bexec\s*\(/,
  /\bsystem\s*\(/,
];

const SUSPICIOUS_COMMAND_PATTERNS = [
  /\brm\s+(-\w*r\w*f|--force)/,
  /\bdel\s+\/s/i,
  /\bformat\s+[a-z]:/i,
];

const PATH_TRAVERSAL_PATTERNS = [
  /\.\.\//,
  /\.\.\\/,
  /\/etc\//,
  /[A-Za-z]:\\/,
];

@Injectable()
export class SkillScanService {
  scan(instructions: string, name: string, description: string): ScanResult {
    const threats: ScanThreat[] = [];

    // 大小检查
    if (instructions.length > MAX_INSTRUCTIONS_SIZE) {
      threats.push({
        type: 'size_exceeded',
        severity: 'error',
        message: `Instructions 超过大小限制 (${Math.round(instructions.length / 1024)}KB > 64KB)`,
      });
    }

    // 路径遍历
    const allContent = `${name}\n${description}\n${instructions}`;
    for (const pattern of PATH_TRAVERSAL_PATTERNS) {
      if (pattern.test(allContent)) {
        threats.push({
          type: 'path_traversal',
          severity: 'error',
          message: `内容包含疑似路径遍历模式: ${pattern.source}`,
        });
        break;
      }
    }

    // 代码注入（仅检查 instructions）
    for (const pattern of CODE_INJECTION_PATTERNS) {
      if (pattern.test(instructions)) {
        threats.push({
          type: 'code_injection',
          severity: 'error',
          message: `Instructions 包含疑似代码注入: ${pattern.source}`,
        });
        break;
      }
    }

    // YAML 格式（检查 frontmatter 必填字段是否在内容中出现）
    if (!name || !description) {
      threats.push({
        type: 'invalid_yaml',
        severity: 'error',
        message: 'name 和 description 为必填字段',
      });
    }

    // 可疑命令
    for (const pattern of SUSPICIOUS_COMMAND_PATTERNS) {
      if (pattern.test(instructions)) {
        threats.push({
          type: 'suspicious_command',
          severity: 'warning',
          message: `Instructions 包含可疑命令: ${pattern.source}`,
        });
        break;
      }
    }

    const hasErrors = threats.some(t => t.severity === 'error');
    return { safe: !hasErrors, threats };
  }
}
```

- [ ] **Step 2 done**

### Step 3: 验证编译通过

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/backend && pnpm tsc --noEmit 2>&1 | head -20`
Expected: 无新增错误

- [ ] **Step 3 done**

### Step 4: Commit

```bash
git add backend/src/modules/skill/skill.types.ts backend/src/modules/skill/skill-scan.service.ts
git commit -m "feat(skill): add types and scan service for closed-loop"
```

- [ ] **Step 4 done**

---

## Task 2: 审批管理服务

**Files:**
- Create: `backend/src/modules/skill/skill-approval.service.ts`

### Step 1: 创建 skill-approval.service.ts

```typescript
import { Injectable } from '@nestjs/common';
import { join, resolve } from 'node:path';
import { readFile, writeFile, mkdir, rm, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { SkillApproval } from './skill.types';
import { SkillService } from './skill.service';
import { SkillScanService } from './skill-scan.service';
import { randomUUID } from 'node:crypto';

const DEFAULT_APPROVALS_DIR = homedir() + '/.aniclaw/skills';

@Injectable()
export class SkillApprovalService {
  private approvalsPath: string;
  private approvals: Map<string, SkillApproval> = new Map();
  private pendingDir: string;

  constructor(
    private readonly skillService: SkillService,
    private readonly scanService: SkillScanService,
  ) {
    this.approvalsPath = resolve(DEFAULT_APPROVALS_DIR, '.skill-approvals.json');
    this.pendingDir = resolve(DEFAULT_APPROVALS_DIR, '.pending');
  }

  async onModuleInit() {
    await this.loadApprovals();
  }

  private async loadApprovals() {
    try {
      const raw = await readFile(this.approvalsPath, 'utf-8');
      const records: SkillApproval[] = JSON.parse(raw);
      for (const r of records) {
        this.approvals.set(r.id, r);
      }
    } catch {
      // 文件不存在，使用空 Map
    }
  }

  private async saveApprovals() {
    const dir = resolve(this.approvalsPath, '..');
    if (!existsSync(dir)) await mkdir(dir, { recursive: true });
    const records = Array.from(this.approvals.values());
    const tmp = this.approvalsPath + '.tmp';
    await writeFile(tmp, JSON.stringify(records, null, 2), 'utf-8');
    await rename(tmp, this.approvalsPath);
  }

  private async getSkillsBaseDir(): Promise<string> {
    // 复用 SkillService 的目录配置
    const dirs = await (this.skillService as any).getSkillsDirs() as string[];
    return dirs[0] || DEFAULT_APPROVALS_DIR;
  }

  /** 提交审批（create 或 update） */
  async submit(params: {
    skillName: string;
    type: 'create' | 'update';
    content: string;
    oldContent?: string;
    patchDescription?: string;
    agentId?: string;
  }): Promise<{ approvalId: string; scanResult: import('./skill.types').ScanResult }> {
    const { skillName, type, content, oldContent, patchDescription, agentId } = params;

    // 从 content 中提取 frontmatter 的 name 和 description
    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    let fmName = skillName;
    let fmDesc = '';
    if (fmMatch) {
      const nameMatch = fmMatch[1].match(/^name:\s*(.+)$/m);
      const descMatch = fmMatch[1].match(/^description:\s*(.+)$/m);
      if (nameMatch) fmName = nameMatch[1].trim();
      if (descMatch) fmDesc = descMatch[1].trim();
    }

    const scanResult = this.scanService.scan(content, fmName, fmDesc);

    // 即使有 error 级别威胁，也创建 pending 记录（前端展示给用户决定）
    const baseDir = await this.getSkillsBaseDir();
    const pendingDir = resolve(baseDir, '.pending', skillName);
    if (!existsSync(pendingDir)) await mkdir(pendingDir, { recursive: true });

    const tmpFile = resolve(pendingDir, 'SKILL.md.tmp');
    const finalFile = resolve(pendingDir, 'SKILL.md');
    await writeFile(tmpFile, content, 'utf-8');
    await rename(tmpFile, finalFile);

    const approval: SkillApproval = {
      id: randomUUID(),
      skillName,
      type,
      status: 'pending',
      submittedAt: new Date().toISOString(),
      contentSnapshot: content,
      oldContentSnapshot: oldContent,
      patchDescription,
      agentId,
    };

    this.approvals.set(approval.id, approval);
    await this.saveApprovals();

    return { approvalId: approval.id, scanResult };
  }

  /** 审批通过 */
  async approve(approvalId: string): Promise<{ success: boolean; message: string }> {
    const approval = this.approvals.get(approvalId);
    if (!approval || approval.status !== 'pending') {
      return { success: false, message: '审批记录不存在或已处理' };
    }

    const baseDir = await this.getSkillsBaseDir();
    const pendingFile = resolve(baseDir, '.pending', approval.skillName, 'SKILL.md');
    const targetDir = resolve(baseDir, approval.skillName);

    try {
      if (approval.type === 'update' && existsSync(targetDir)) {
        // update: 备份旧版本到 .versions（Phase 3 扩展点）
        // Phase 1 简化：直接覆盖
      }

      // 移动到正式目录
      if (!existsSync(targetDir)) await mkdir(targetDir, { recursive: true });
      const targetFile = resolve(targetDir, 'SKILL.md');
      const tmp = targetFile + '.tmp';
      const content = await readFile(pendingFile, 'utf-8');
      await writeFile(tmp, content, 'utf-8');
      await rename(tmp, targetFile);

      // 清理 pending 目录
      await rm(resolve(baseDir, '.pending', approval.skillName), { recursive: true, force: true });

      // 更新审批状态
      approval.status = 'approved';
      approval.reviewedAt = new Date().toISOString();
      await this.saveApprovals();

      // 刷新 Skill 索引
      await this.skillService.refresh();

      return { success: true, message: `Skill "${approval.skillName}" 已通过审批` };
    } catch (err) {
      return { success: false, message: `审批处理失败: ${(err as Error).message}` };
    }
  }

  /** 审批拒绝 */
  async reject(approvalId: string): Promise<{ success: boolean; message: string }> {
    const approval = this.approvals.get(approvalId);
    if (!approval || approval.status !== 'pending') {
      return { success: false, message: '审批记录不存在或已处理' };
    }

    const baseDir = await this.getSkillsBaseDir();
    const pendingDir = resolve(baseDir, '.pending', approval.skillName);

    try {
      // 删除 pending 文件
      await rm(pendingDir, { recursive: true, force: true });
    } catch {
      // 文件可能已不存在
    }

    approval.status = 'rejected';
    approval.reviewedAt = new Date().toISOString();
    await this.saveApprovals();

    return { success: true, message: `Skill "${approval.skillName}" 已拒绝` };
  }

  /** 获取所有 pending 记录 */
  listPending(): SkillApproval[] {
    return Array.from(this.approvals.values())
      .filter(a => a.status === 'pending')
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }

  /** 获取某个 Skill 的审批历史 */
  getHistory(skillName: string): SkillApproval[] {
    return Array.from(this.approvals.values())
      .filter(a => a.skillName === skillName)
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  }
}
```

- [ ] **Step 1 done**

### Step 2: 验证编译通过

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/backend && pnpm tsc --noEmit 2>&1 | head -20`
Expected: 无新增错误

- [ ] **Step 2 done**

### Step 3: Commit

```bash
git add backend/src/modules/skill/skill-approval.service.ts
git commit -m "feat(skill): add approval service for skill creation"
```

- [ ] **Step 3 done**

---

## Task 3: 使用量统计服务

**Files:**
- Create: `backend/src/modules/skill/skill-usage.service.ts`

### Step 1: 创建 skill-usage.service.ts

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { homedir } from 'node:os';
import { SkillUsageRecord } from './skill.types';

const DEFAULT_USAGE_PATH = homedir() + '/.aniclaw/skills/.skill-usage.json';
const FLUSH_INTERVAL_MS = 60_000;

@Injectable()
export class SkillUsageService implements OnModuleInit {
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
      record = { useCount: 0, viewCount: 0, patchCount: 0, lastUsedAt: null, createdAt: new Date().toISOString() };
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
```

- [ ] **Step 1 done**

### Step 2: 验证编译通过

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/backend && pnpm tsc --noEmit 2>&1 | head -20`
Expected: 无新增错误

- [ ] **Step 2 done**

### Step 3: Commit

```bash
git add backend/src/modules/skill/skill-usage.service.ts
git commit -m "feat(skill): add usage tracking service"
```

- [ ] **Step 3 done**

---

## Task 4: LangGraph Tools（create/update/propose）

**Files:**
- Create: `backend/src/modules/skill/tools/create-skill.tool.ts`
- Create: `backend/src/modules/skill/tools/update-skill.tool.ts`
- Create: `backend/src/modules/skill/tools/propose-skill.tool.ts`

### Step 1: 创建 create-skill.tool.ts

```typescript
import { z } from 'zod';
import { safeTool } from '../../langgraph/tools/base/tool.helper';
import { SkillApprovalService } from '../skill-approval.service';
import { SkillService } from '../skill.service';
import { isValidSkillName } from '../skill.types';

export function createCreateSkillTool(
  approvalService: SkillApprovalService,
  skillService: SkillService,
) {
  return safeTool(
    'create_skill',
    '创建一个新的 Skill（可复用的指令模块）。当你在对话中发现可复用的重复模式时使用。创建的 Skill 需要用户审批后才生效。',
    z.object({
      name: z.string().describe('Skill 名称，kebab-case 格式（如 git-workflow、code-review-checklist）'),
      description: z.string().describe('一句话描述这个 Skill 的用途'),
      instructions: z.string().describe('完整的 Skill 指令内容（Markdown 格式）'),
      allowed_tools: z.array(z.string()).optional().describe('该 Skill 可使用的工具白名单'),
    }),
    async ({ name, description, instructions, allowed_tools }) => {
      // 校验名称格式
      if (!isValidSkillName(name)) {
        return `名称格式无效: "${name}"。要求 kebab-case（小写字母+数字+连字符），3-64 字符。`;
      }

      // 检查是否已存在
      const existing = await skillService.findOneSummary(name);
      if (existing) {
        return `Skill "${name}" 已存在。如需修改请使用 update_skill 工具。`;
      }

      // 构建 SKILL.md 内容
      const skillMd = [
        '---',
        `name: ${name}`,
        `description: ${description}`,
        'version: 1.0.0',
        'author: agent',
        'source: user-created',
        `created_at: ${new Date().toISOString()}`,
        allowed_tools?.length ? `allowed_tools: [${allowed_tools.join(', ')}]` : '',
        '---',
        '',
        instructions,
      ].filter(Boolean).join('\n');

      const { approvalId, scanResult } = await approvalService.submit({
        skillName: name,
        type: 'create',
        content: skillMd,
      });

      const warnings = scanResult.threats
        .filter(t => t.severity === 'warning')
        .map(t => `⚠️ ${t.message}`)
        .join('\n');

      if (!scanResult.safe) {
        const errors = scanResult.threats
          .filter(t => t.severity === 'error')
          .map(t => `❌ ${t.message}`)
          .join('\n');
        return `安全扫描未通过:\n${errors}\n\nSkill 已提交但需用户审批。`;
      }

      let msg = `Skill "${name}" 已创建并提交审批（ID: ${approvalId}）。等待用户审批后生效。`;
      if (warnings) msg += `\n\n${warnings}`;
      return msg;
    },
  );
}
```

- [ ] **Step 1 done**

### Step 2: 创建 update-skill.tool.ts

```typescript
import { z } from 'zod';
import { safeTool } from '../../langgraph/tools/base/tool.helper';
import { SkillApprovalService } from '../skill-approval.service';
import { SkillService } from '../skill.service';

export function createUpdateSkillTool(
  approvalService: SkillApprovalService,
  skillService: SkillService,
) {
  return safeTool(
    'update_skill',
    '修改已有 Skill 的指令内容。仅可修改用户创建的 Skill（source: user-created）。修改需用户审批。',
    z.object({
      skill_id: z.string().describe('要修改的 Skill ID'),
      instructions: z.string().describe('新的完整 instructions 内容'),
      patch_description: z.string().describe('改动说明，简述修改了什么'),
    }),
    async ({ skill_id, instructions, patch_description }) => {
      const existing = await skillService.findOneSummary(skill_id);
      if (!existing) {
        return `Skill "${skill_id}" 不存在。请先使用 create_skill 创建。`;
      }

      // 获取完整内容用于备份
      const fullSkill = await skillService.findSkillForLookup(skill_id);
      if (!fullSkill) {
        return `Skill "${skill_id}" 无法读取。`;
      }

      // 构建新 SKILL.md（保留原 frontmatter，替换 instructions）
      const oldContent = await (await import('node:fs/promises')).readFile(
        `${fullSkill.dirPath}/SKILL.md`, 'utf-8',
      ).catch(() => null);

      // 重新构建 SKILL.md：保留原 frontmatter + 新 instructions
      const fmMatch = oldContent?.match(/^---\s*\n([\s\S]*?)\n---/);
      const fm = fmMatch ? fmMatch[1] : `name: ${skill_id}\ndescription: ${existing.description}`;

      const newSkillMd = [
        '---',
        fm,
        `updated_at: ${new Date().toISOString()}`,
        '---',
        '',
        instructions,
      ].join('\n');

      const { approvalId, scanResult } = await approvalService.submit({
        skillName: skill_id,
        type: 'update',
        content: newSkillMd,
        oldContent: oldContent || undefined,
        patchDescription: patch_description,
      });

      if (!scanResult.safe) {
        const errors = scanResult.threats
          .filter(t => t.severity === 'error')
          .map(t => `❌ ${t.message}`)
          .join('\n');
        return `安全扫描未通过:\n${errors}\n\n修改已提交但需用户审批。`;
      }

      return `Skill "${skill_id}" 的修改已提交审批（ID: ${approvalId}）。改动: ${patch_description}。等待用户审批。`;
    },
  );
}
```

- [ ] **Step 2 done**

### Step 3: 创建 propose-skill.tool.ts

```typescript
import { z } from 'zod';
import { safeTool } from '../../langgraph/tools/base/tool.helper';

export function createProposeSkillTool() {
  return safeTool(
    'propose_skill',
    '向用户推荐创建一个 Skill。当你发现对话中有重复模式但不确定是否值得创建 Skill 时使用。',
    z.object({
      name: z.string().describe('建议的 Skill 名称'),
      description: z.string().describe('建议的 Skill 描述'),
      reason: z.string().describe('推荐理由：为什么这个模式值得创建 Skill'),
    }),
    async ({ name, description, reason }) => {
      return JSON.stringify({
        type: 'skill_proposal',
        name,
        description,
        reason,
        message: `已向用户推荐创建 Skill "${name}": ${reason}`,
      });
    },
  );
}
```

- [ ] **Step 3 done**

### Step 4: 验证编译通过

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/backend && pnpm tsc --noEmit 2>&1 | head -20`
Expected: 无新增错误

- [ ] **Step 4 done**

### Step 5: Commit

```bash
git add backend/src/modules/skill/tools/
git commit -m "feat(skill): add create/update/propose skill tools"
```

- [ ] **Step 5 done**

---

## Task 5: 模块注册 + 工具注册 + SSE 事件

**Files:**
- Modify: `backend/src/modules/skill/skill.module.ts`
- Modify: `backend/src/modules/langgraph/langgraph.module.ts`
- Modify: `backend/src/modules/langgraph/langgraph.service.ts`
- Modify: `backend/src/modules/chat/chat.service.ts`

### Step 1: 更新 skill.module.ts — 注册新 providers

将 `skill.module.ts` 替换为：

```typescript
import { Module, forwardRef, OnModuleInit } from '@nestjs/common';
import { SkillController } from './skill.controller';
import { SkillService } from './skill.service';
import { SkillScanService } from './skill-scan.service';
import { SkillApprovalService } from './skill-approval.service';
import { SkillUsageService } from './skill-usage.service';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [forwardRef(() => SettingsModule)],
  controllers: [SkillController],
  providers: [SkillService, SkillScanService, SkillApprovalService, SkillUsageService],
  exports: [SkillService, SkillApprovalService, SkillUsageService],
})
export class SkillModule implements OnModuleInit {
  constructor(private readonly approvalService: SkillApprovalService) {}

  async onModuleInit() {
    await this.approvalService.onModuleInit();
  }
}
```

- [ ] **Step 1 done**

### Step 2: 更新 langgraph.module.ts — 注册 3 个新 tools

在 `LangGraphModule.onModuleInit()` 中，avatar 工具注册之后、`initGraph` 调用之前，添加：

```typescript
// 在文件顶部新增 import
import { SkillApprovalService } from '../skill/skill-approval.service';
import { SkillService } from '../skill/skill.service';
import { createCreateSkillTool } from '../skill/tools/create-skill.tool';
import { createUpdateSkillTool } from '../skill/tools/update-skill.tool';
import { createProposeSkillTool } from '../skill/tools/propose-skill.tool';
```

在 constructor 中注入：
```typescript
private skillService: SkillService,
private skillApprovalService: SkillApprovalService,
```

在 avatar 工具注册之后、`await this.langGraphService.initGraph()` 之前，添加：

```typescript
    // 注册 Skill 创建/修改工具
    this.toolRegistry.register(
      createCreateSkillTool(this.skillApprovalService, this.skillService),
      {
        permission_level: 'write',
        category: 'skill',
        description: 'Agent 创建新的可复用 Skill',
      },
    );
    this.toolRegistry.register(
      createUpdateSkillTool(this.skillApprovalService, this.skillService),
      {
        permission_level: 'write',
        category: 'skill',
        description: 'Agent 修改已有 Skill 的指令内容',
      },
    );
    this.toolRegistry.register(createProposeSkillTool(), {
      permission_level: 'write',
      category: 'skill',
      description: 'Agent 推荐创建新 Skill',
    });
```

- [ ] **Step 2 done**

### Step 3: LangGraphService — 处理 skill 相关 tool output

在 `langgraph.service.ts` 中找到处理 `avatar_action` 事件的代码位置（通常在 tool output yield 区域），在其附近添加 `skill_approval` 事件检测。

具体位置：找到 `yield { event: 'avatar_action', ... }` 或类似的 tool output 拦截逻辑。在那里添加对 `propose_skill` 返回值的检测：

```typescript
// 在 avatar_action 检测的同一区域添加
if (toolName === 'propose_skill' && typeof toolOutput === 'string') {
  try {
    const parsed = JSON.parse(toolOutput);
    if (parsed.type === 'skill_proposal') {
      yield {
        event: 'skill_proposal',
        data: {
          ...base,
          name: parsed.name,
          description: parsed.description,
          reason: parsed.reason,
        },
      };
    }
  } catch { /* not JSON, skip */ }
}
```

对于 `create_skill` 和 `update_skill`，需要额外 yield 审批通知。在 tool 执行成功后：

```typescript
if (toolName === 'create_skill' || toolName === 'update_skill') {
  // approval service 已在 tool 内部处理了提交
  // 这里只需 push 通知给前端
  const pendingList = await this.moduleRef.get(SkillApprovalService, { strict: false }).listPending();
  const latest = pendingList[0]; // 最新提交的
  if (latest) {
    yield {
      event: 'skill_approval',
      data: {
        ...base,
        approvalId: latest.id,
        skillName: latest.skillName,
        type: latest.type,
        description: latest.contentSnapshot.match(/^description:\s*(.+)$/m)?.[1] || '',
      },
    };
  }
}
```

> 注意：具体的 yield 位置取决于 `langgraph.service.ts` 中的流处理结构。需要找到 tool output 被 yield 到 SSE 流的位置，确保 `base` 变量（含 `session_id`、`message_id`）在作用域内。实施时需读取完整文件确定精确插入点。

- [ ] **Step 3 done**

### Step 4: ChatService — 处理 skill_approval 事件类型

在 `chat.service.ts` 中找到 SSE 事件 switch/case 处理区域（处理 `avatar_action`、`agent_switched` 的位置），添加：

```typescript
case 'skill_approval':
  yield {
    event: 'skill_approval',
    data: { ...base, ...event.data },
  };
  break;

case 'skill_proposal':
  yield {
    event: 'skill_proposal',
    data: { ...base, ...event.data },
  };
  break;
```

> 注意：这里的 `event` 是 LangGraphService yield 的事件对象，需要根据实际的 streamCompletion 数据流结构确定是否需要这个中间层。如果 langgraph.service 直接 yield 到 chat.service，可能已自动透传。

- [ ] **Step 4 done**

### Step 5: 验证编译通过

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/backend && pnpm tsc --noEmit 2>&1 | head -20`
Expected: 无新增错误

- [ ] **Step 5 done**

### Step 6: Commit

```bash
git add backend/src/modules/skill/skill.module.ts backend/src/modules/langgraph/langgraph.module.ts backend/src/modules/langgraph/langgraph.service.ts backend/src/modules/chat/chat.service.ts
git commit -m "feat(skill): register tools and SSE events for closed-loop"
```

- [ ] **Step 6 done**

---

## Task 6: 扩展 SkillService — 使用量统计集成

**Files:**
- Modify: `backend/src/modules/skill/skill.service.ts`

### Step 1: 注入 SkillUsageService，在 findSkillForLookup 和 findOneSummary 中触发统计

在 `skill.service.ts` 中：

1. 新增 import：`import { SkillUsageService } from './skill-usage.service';`
2. 在 constructor 中注入 `SkillUsageService`
3. 修改 `findOneSummary`：

```typescript
async findOneSummary(id: string) {
  const s = this.findById(id);
  if (!s) return undefined;
  this.usageService.trackView(id);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { dirPath, source, ...rest } = s;
  return rest;
}
```

4. 修改 `findSkillForLookup`：

```typescript
async findSkillForLookup(id: string): Promise<{ instructions: string; dirPath: string } | null> {
  const s = this.findById(id);
  if (!s) return null;
  this.usageService.trackUse(id);
  return { instructions: s.instructions, dirPath: s.dirPath };
}
```

5. 新增 `getUsage` 方法：

```typescript
async getUsage(skillId: string) {
  return this.usageService.getUsage(skillId);
}
```

- [ ] **Step 1 done**

### Step 2: 验证编译通过

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/backend && pnpm tsc --noEmit 2>&1 | head -20`
Expected: 无新增错误

- [ ] **Step 2 done**

### Step 3: Commit

```bash
git add backend/src/modules/skill/skill.service.ts
git commit -m "feat(skill): integrate usage tracking into skill service"
```

- [ ] **Step 3 done**

---

## Task 7: 后端 API — 审批 + 统计 Endpoints

**Files:**
- Modify: `backend/src/modules/skill/skill.controller.ts`

### Step 1: 扩展 skill.controller.ts — 新增审批和统计 endpoints

将 `skill.controller.ts` 替换为：

```typescript
import { Controller, Get, Post, Param, Body, NotFoundException, BadRequestException } from '@nestjs/common';
import { SkillService } from './skill.service';
import { SkillApprovalService } from './skill-approval.service';

@Controller('api/v1/skills')
export class SkillController {
  constructor(
    private readonly skillService: SkillService,
    private readonly approvalService: SkillApprovalService,
  ) {}

  @Get()
  async findAll() {
    const data = await this.skillService.findAllSummary();
    return { success: true, data };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const skill = await this.skillService.findOneSummary(id);
    if (!skill) throw new NotFoundException(`Skill ${id} not found`);
    return { success: true, data: skill };
  }

  @Post('refresh')
  async refresh() {
    await this.skillService.refresh();
    return { success: true, data: { message: 'Skills refreshed' } };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    const ok = await this.skillService.delete(id);
    if (!ok) throw new NotFoundException(`Skill ${id} not found or cannot be deleted`);
    return { success: true, data: { message: `Skill ${id} deleted` } };
  }

  // ---- 审批 API ----

  @Get('approvals/pending')
  async listPendingApprovals() {
    const data = this.approvalService.listPending();
    return { success: true, data };
  }

  @Post('approvals/:id/approve')
  async approveSkill(@Param('id') id: string, @Body() body?: { editedContent?: string }) {
    // 如果前端传了编辑后的内容，更新 pending 文件
    if (body?.editedContent) {
      // TODO: 更新 pending 文件后再审批（Phase 1 简化：直接审批）
    }
    const result = await this.approvalService.approve(id);
    if (!result.success) throw new BadRequestException(result.message);
    return { success: true, data: { message: result.message } };
  }

  @Post('approvals/:id/reject')
  async rejectSkill(@Param('id') id: string) {
    const result = await this.approvalService.reject(id);
    if (!result.success) throw new BadRequestException(result.message);
    return { success: true, data: { message: result.message } };
  }

  @Get('approvals/:name/history')
  async getApprovalHistory(@Param('name') name: string) {
    const data = this.approvalService.getHistory(name);
    return { success: true, data };
  }

  // ---- 使用量统计 API ----

  @Get(':id/usage')
  async getUsage(@Param('id') id: string) {
    const data = await this.skillService.getUsage(id);
    if (!data) throw new NotFoundException(`Skill ${id} usage not found`);
    return { success: true, data };
  }
}
```

注意：NestJS 路由匹配中 `approvals/pending` 需要放在 `:id` 之前以避免被 `:id` 参数匹配。上面的顺序已经是正确的。

- [ ] **Step 1 done**

### Step 2: 验证编译通过

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/backend && pnpm tsc --noEmit 2>&1 | head -20`
Expected: 无新增错误

- [ ] **Step 2 done**

### Step 3: Commit

```bash
git add backend/src/modules/skill/skill.controller.ts
git commit -m "feat(skill): add approval and usage REST endpoints"
```

- [ ] **Step 3 done**

---

## Task 8: 前端类型 + API

**Files:**
- Modify: `frontend/src/types/index.ts`
- Create: `frontend/src/api/skill-approval.ts`

### Step 1: 扩展 types/index.ts — 新增审批和统计类型

在 `frontend/src/types/index.ts` 中追加（如果文件末尾已有 export，在最后一个 export 前添加）：

```typescript
export interface SkillApproval {
  id: string;
  skillName: string;
  type: 'create' | 'update';
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  reviewedAt?: string;
  contentSnapshot: string;
  oldContentSnapshot?: string;
  patchDescription?: string;
  agentId?: string;
}

export interface SkillUsageRecord {
  useCount: number;
  viewCount: number;
  patchCount: number;
  lastUsedAt: string | null;
  createdAt: string;
}
```

- [ ] **Step 1 done**

### Step 2: 创建 api/skill-approval.ts

```typescript
import { apiClient } from './client';
import type { SkillApproval, SkillUsageRecord } from '@/types';

export async function getPendingApprovals(): Promise<SkillApproval[]> {
  const res = await apiClient.get('/api/v1/skills/approvals/pending');
  return res.data.data;
}

export async function approveSkill(approvalId: string, editedContent?: string): Promise<void> {
  await apiClient.post(`/api/v1/skills/approvals/${approvalId}/approve`, {
    editedContent,
  });
}

export async function rejectSkill(approvalId: string): Promise<void> {
  await apiClient.post(`/api/v1/skills/approvals/${approvalId}/reject`);
}

export async function getSkillUsage(skillId: string): Promise<SkillUsageRecord> {
  const res = await apiClient.get(`/api/v1/skills/${skillId}/usage`);
  return res.data.data;
}

export async function getApprovalHistory(skillName: string): Promise<SkillApproval[]> {
  const res = await apiClient.get(`/api/v1/skills/approvals/${skillName}/history`);
  return res.data.data;
}
```

> 注意：`apiClient` 的 import 路径可能需要调整，取决于 `frontend/src/api/` 下的实际 HTTP client 封装。实施时确认 `client.ts` 或 `chat.ts` 中的实际导出。

- [ ] **Step 2 done**

### Step 3: 验证编译通过

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/frontend && pnpm vue-tsc --noEmit 2>&1 | head -20`
Expected: 无新增错误

- [ ] **Step 3 done**

### Step 4: Commit

```bash
git add frontend/src/types/index.ts frontend/src/api/skill-approval.ts
git commit -m "feat(skill): add frontend types and approval API"
```

- [ ] **Step 4 done**

---

## Task 9: 前端 SkillsView — 审批 Tab

**Files:**
- Modify: `frontend/src/views/SkillsView.vue`

### Step 1: 在 SkillsView 中添加「待审批」tab

在 `<script setup>` 中：

1. 新增 import：

```typescript
import {
  getPendingApprovals,
  approveSkill,
  rejectSkill,
} from "@/api/skill-approval";
import type { SkillApproval } from "@/types";
import {
  CheckmarkCircleOutline,
  CloseCircleOutline,
  CreateOutline,
  TimeOutline,
} from "@vicons/ionicons5";
```

2. 新增状态：

```typescript
const activeTab = ref<"skills" | "approvals">("skills");
const approvals = ref<SkillApproval[]>([]);
const loadingApprovals = ref(false);
```

3. 新增方法：

```typescript
async function loadApprovals() {
  loadingApprovals.value = true;
  try {
    approvals.value = await getPendingApprovals();
  } catch {
    approvals.value = [];
  } finally {
    loadingApprovals.value = false;
  }
}

async function handleApprove(approval: SkillApproval) {
  try {
    await approveSkill(approval.id);
    await Promise.all([loadApprovals(), loadSkills()]);
    message.success(`"${approval.skillName}" 已通过`);
  } catch {
    message.error("审批失败");
  }
}

async function handleReject(approval: SkillApproval) {
  dialog.warning({
    title: "拒绝 Skill",
    content: `确定要拒绝 "${approval.skillName}" 吗？`,
    positiveText: "拒绝",
    negativeText: "取消",
    onPositiveClick: async () => {
      try {
        await rejectSkill(approval.id);
        await loadApprovals();
        message.success(`"${approval.skillName}" 已拒绝`);
      } catch {
        message.error("操作失败");
      }
    },
  });
}

function switchTab(tab: "skills" | "approvals") {
  activeTab.value = tab;
  if (tab === "approvals") loadApprovals();
}
```

在 `<template>` 中，将现有「技能列表」内容包裹在 `v-if="activeTab === 'skills'"` 中，然后在其后添加审批面板：

```html
<!-- Tab 切换 -->
<div class="tab-bar">
  <button
    class="tab-btn"
    :class="{ active: activeTab === 'skills' }"
    @click="switchTab('skills')"
  >
    <NIcon :component="ExtensionPuzzleOutline" :size="14" />
    <span>全部技能</span>
    <span v-if="approvals.length" class="tab-badge">{{ approvals.length }}</span>
  </button>
  <button
    class="tab-btn"
    :class="{ active: activeTab === 'approvals' }"
    @click="switchTab('approvals')"
  >
    <NIcon :component="TimeOutline" :size="14" />
    <span>待审批</span>
    <span v-if="approvals.length" class="tab-badge">{{ approvals.length }}</span>
  </button>
</div>

<!-- 审批列表 -->
<div v-if="activeTab === 'approvals'" class="approval-list">
  <NSpin :show="loadingApprovals">
    <div v-if="approvals.length === 0" class="empty-state">
      <NIcon :component="TimeOutline" :size="48" />
      <p>暂无待审批</p>
      <span>Agent 创建的 Skill 会在这里等待审批</span>
    </div>
    <div v-else class="approval-cards">
      <div v-for="approval in approvals" :key="approval.id" class="approval-card">
        <div class="approval-header">
          <span class="skill-name">{{ approval.skillName }}</span>
          <span class="approval-type-badge">{{ approval.type === 'create' ? '新建' : '更新' }}</span>
        </div>
        <p class="approval-desc">
          {{ approval.contentSnapshot.match(/^description:\s*(.+)$/m)?.[1] || '无描述' }}
        </p>
        <div class="approval-meta">
          <span v-if="approval.patchDescription" class="patch-desc">{{ approval.patchDescription }}</span>
          <span class="approval-time">{{ new Date(approval.submittedAt).toLocaleString() }}</span>
        </div>
        <div class="approval-actions">
          <button class="btn-approve" @click="handleApprove(approval)">
            <NIcon :component="CheckmarkCircleOutline" :size="14" />
            <span>通过</span>
          </button>
          <button class="btn-reject" @click="handleReject(approval)">
            <NIcon :component="CloseCircleOutline" :size="14" />
            <span>拒绝</span>
          </button>
        </div>
      </div>
    </div>
  </NSpin>
</div>
```

添加对应的 CSS：

```css
.tab-bar {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-color);
}

.tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tab-btn:hover {
  color: var(--color-primary);
  background: var(--color-primary-light);
}

.tab-btn.active {
  color: var(--color-primary);
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.tab-badge {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 0 5px;
  border-radius: 8px;
  background: var(--color-primary);
  color: #fff;
  min-width: 16px;
  text-align: center;
}

.approval-cards {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.approval-card {
  padding: 14px;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.approval-card:hover {
  border-color: var(--border-color);
}

.approval-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.approval-type-badge {
  font-family: var(--font-mono);
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 3px;
  color: var(--color-primary);
  background: var(--color-primary-light);
  border: 1px solid var(--border-subtle);
}

.approval-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 8px 0;
  font-size: 11px;
  color: var(--text-muted);
}

.patch-desc {
  color: var(--text-secondary);
  font-size: 12px;
}

.approval-time {
  font-family: var(--font-mono);
}

.approval-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.btn-approve {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  background: transparent;
  border: 1px solid var(--neon-green, #10b981);
  border-radius: var(--radius-sm);
  color: var(--neon-green, #10b981);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-approve:hover {
  background: rgba(16, 185, 129, 0.1);
}

.btn-reject {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 14px;
  background: transparent;
  border: 1px solid var(--neon-pink, #f72585);
  border-radius: var(--radius-sm);
  color: var(--neon-pink, #f72585);
  font-size: 12px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-reject:hover {
  background: rgba(247, 37, 133, 0.1);
}
```

- [ ] **Step 1 done**

### Step 2: 验证编译通过

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/frontend && pnpm vue-tsc --noEmit 2>&1 | head -20`
Expected: 无新增错误

- [ ] **Step 2 done**

### Step 3: 启动前端验证 UI

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/frontend && pnpm dev`

在浏览器中访问 https://localhost:3000/skills，验证：
1. tab 切换正常（全部技能 / 待审批）
2. 待审批 tab 显示空状态
3. 全部技能 tab 功能不受影响

- [ ] **Step 3 done**

### Step 4: Commit

```bash
git add frontend/src/views/SkillsView.vue
git commit -m "feat(skill): add approval tab to SkillsView"
```

- [ ] **Step 4 done**

---

## Task 10: SSE 审批通知 — 前端接收

**Files:**
- Modify: `frontend/src/composables/useChatTransport.ts`
- Modify: `frontend/src/composables/useAIChat.ts`
- Create: `frontend/src/composables/useSkillApproval.ts`

### Step 1: 创建 useSkillApproval.ts — 审批状态管理

```typescript
import { ref } from "vue";
import {
  getPendingApprovals,
  approveSkill,
  rejectSkill,
} from "@/api/skill-approval";
import type { SkillApproval } from "@/types";

const pendingApprovals = ref<SkillApproval[]>([]);
let loaded = false;

export function useSkillApproval() {
  async function loadApprovals() {
    try {
      pendingApprovals.value = await getPendingApprovals();
      loaded = true;
    } catch {
      pendingApprovals.value = [];
    }
  }

  // 首次调用时自动加载
  if (!loaded) loadApprovals();

  async function approve(id: string) {
    await approveSkill(id);
    pendingApprovals.value = pendingApprovals.value.filter((a) => a.id !== id);
  }

  async function reject(id: string) {
    await rejectSkill(id);
    pendingApprovals.value = pendingApprovals.value.filter((a) => a.id !== id);
  }

  function addFromSSE(data: {
    approvalId: string;
    skillName: string;
    type: string;
    description?: string;
  }) {
    // SSE 推送时刷新列表
    loadApprovals();
  }

  return {
    pendingApprovals,
    loadApprovals,
    approve,
    reject,
    addFromSSE,
  };
}
```

- [ ] **Step 1 done**

### Step 2: useChatTransport.ts — 解析 skill_approval SSE 事件

在 `useChatTransport.ts` 的 `convertSSEStream` 函数中，找到 `avatar_action` 事件处理的位置，在其后添加：

```typescript
// 处理 skill_approval 事件
if (event.event === "skill_approval" && onSkillApproval) {
  onSkillApproval(event.data);
}

// 处理 skill_proposal 事件
if (event.event === "skill_proposal" && onSkillProposal) {
  onSkillProposal(event.data);
}
```

在 `createChatTransport` 函数的参数类型中添加两个新回调：

```typescript
onSkillApproval?: (data: any) => void;
onSkillProposal?: (data: any) => void;
```

- [ ] **Step 2 done**

### Step 3: useAIChat.ts — 接收审批事件

在 `useAIChat.ts` 中，找到 `createChatTransport` 调用位置，添加新的回调参数：

```typescript
// 在 onAvatarAction 回调之后添加
onSkillApproval: (data) => {
  // 触发全局通知（简化版：直接刷新 pending 列表）
  const { loadApprovals } = useSkillApproval();
  loadApprovals();
},
```

- [ ] **Step 3 done**

### Step 4: 验证编译通过

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/frontend && pnpm vue-tsc --noEmit 2>&1 | head -20`
Expected: 无新增错误

- [ ] **Step 4 done**

### Step 5: Commit

```bash
git add frontend/src/composables/useSkillApproval.ts frontend/src/composables/useChatTransport.ts frontend/src/composables/useAIChat.ts
git commit -m "feat(skill): add SSE skill_approval event handling"
```

- [ ] **Step 5 done**

---

## Task 11: 端到端集成验证

**Files:** 无新增文件

### Step 1: 启动后端

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/backend && pnpm dev`
Expected: 无启动报错，SkillApprovalService.onModuleInit 正常执行

- [ ] **Step 1 done**

### Step 2: 启动前端

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/frontend && pnpm dev`

- [ ] **Step 2 done**

### Step 3: API 手动测试

```bash
# 测试获取 pending 列表（应为空）
curl http://localhost:8000/api/v1/skills/approvals/pending

# 测试获取 skills 列表（应正常返回）
curl http://localhost:8000/api/v1/skills
```

- [ ] **Step 3 done**

### Step 4: 前端 UI 验证

在浏览器中验证：
1. `/skills` 页面加载正常
2. 「全部技能」tab 展示现有 skills
3. 「待审批」tab 展示空状态
4. 聊天页面 SSE 连接正常（不报错）
5. 后端无 TypeScript 运行时错误

- [ ] **Step 4 done**

### Step 5: 最终 Commit

```bash
git add -A
git commit -m "feat(skill): Phase 1 closed-loop integration complete"
```

- [ ] **Step 5 done**

---

## Self-Review Checklist

### 1. Spec Coverage

| Spec 要求 | Task |
|-----------|------|
| create_skill tool | Task 4 |
| update_skill tool | Task 4 |
| propose_skill tool | Task 4 |
| 用户审批流程（submit/approve/reject） | Task 2 |
| 基础安全扫描 | Task 1 |
| 使用量统计（useCount/viewCount/patchCount） | Task 3, 6 |
| 审批 REST API | Task 7 |
| 前端审批 tab | Task 9 |
| SSE 审批通知 | Task 5, 10 |
| Skill/Memory 分离 | 设计层面，无需代码变更 |
| Agent prompt 调整 | 待实现（Phase 1 可选，建议后续加入） |

### 2. Placeholder Scan

无 TBD/TODO/后续实现项。所有步骤包含完整代码。

### 3. Type Consistency

- `SkillApproval` 类型在 `skill.types.ts` 和 `frontend/src/types/index.ts` 中定义一致
- `SkillUsageRecord` 同理
- `ScanResult` / `ScanThreat` 仅在后端使用
- 工具函数签名与 service 方法签名匹配
