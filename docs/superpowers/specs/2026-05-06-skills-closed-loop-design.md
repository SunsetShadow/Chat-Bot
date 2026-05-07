# Skills 闭环自进化系统设计

> 基于 Hermes Agent (Nous Research) Skills 系统的 7 阶段闭环理念，结合 Chat-Bot 现有架构分阶段实现。

## 1. 设计目标

让 Agent 在对话中发现重复模式时自动创建 Skill，通过用户审批后生效，使用中积累经验并自动改进——形成「发现 → 创建 → 审批 → 使用 → 改进」的闭环。

### 设计原则

- **渐进式**：3 个 Phase，每个 Phase 独立可用，不依赖后续 Phase
- **用户控制**：Agent 创建的 Skill 必须经过用户审批
- **文件系统优先**：延续现有 SKILL.md 存储方式，不引入 DB 依赖
- **Skill/Memory 分离**：Skill 记录「怎么做」，Memory 记录「是什么」，存储和检索完全独立

## 2. 现状分析

### 当前系统能力

- 多源 Skill 加载（系统/示例/用户自定义，优先级合并）
- YAML frontmatter 解析 + Markdown instructions
- `lookup_skill` 渐进式加载（index → full → reference）
- `buildSkillIndex()` 注入 Agent prompt
- Token budget 控制（18,000 字符）
- SkillsView 管理 UI（搜索/刷新/删除）
- 路径安全校验（realpath + isPathInside）

### 缺失能力（本设计补全）

| 能力 | Phase |
|------|-------|
| Agent 创建/修改 Skill | Phase 1 |
| 用户审批流程 | Phase 1 |
| 基础安全扫描 | Phase 1 |
| 使用量统计 | Phase 1 |
| Fuzzy Match 模糊匹配 | Phase 2 |
| 条件激活（requires/fallback） | Phase 2 |
| 二层缓存（LRU + disk） | Phase 2 |
| 经验提取 + 自动 Patch | Phase 3 |
| Curator 生命周期管理 | Phase 3 |
| 完整安全扫描（90+ 模式） | Phase 3 |

## 3. Phase 1：核心闭环

### 3.1 Agent 创建 Skill 工具链

新增 3 个 LangGraph Tool（`safeTool` 包装），注册到 `ToolRegistryService`（category: `'skill'`）。

#### `create_skill`

Agent 发现可复用的重复模式时调用，创建新 Skill。

**输入参数：**

```typescript
{
  name: string;           // Skill 名称，kebab-case，如 "git-workflow"
  description: string;    // 一句话描述，用于 index 展示和检索
  instructions: string;   // 完整指令内容（Markdown）
  allowedTools?: string[];// 该 Skill 可使用的工具白名单
}
```

**处理流程：**

1. 校验 name 格式（`^[a-z][a-z0-9-]*$`，3-64 字符）
2. 检查同名 Skill 是否已存在
3. 基础安全扫描（见 3.3）
4. 写入临时文件到 `user-skills/.pending/{name}/SKILL.md`
5. 记录到 `.skill-approvals.json`，状态 `pending`
6. 通过 SSE 推送审批通知给前端
7. 返回：`{ skillId, status: "pending", message: "Skill 已提交，等待用户审批" }`

**SKILL.md 模板：**

```markdown
---
name: {name}
description: {description}
version: 1.0.0
author: agent
source: user-created
created_at: {ISO timestamp}
allowed_tools: {allowedTools}
---

{instructions}
```

**约束：**

- 仅 Ani（默认 Supervisor Agent）可直接调用；其他 Agent 需通过 Ani 路由
- 单次对话中最多创建 3 个 Skill（防滥用）
- instructions 内容 ≤ 64KB

#### `update_skill`

Agent 修改已有 Skill 的 instructions 内容。

**输入参数：**

```typescript
{
  skill_id: string;          // 目标 Skill ID
  instructions: string;      // 新的完整 instructions
  patch_description: string; // 改动说明，记录 changelog
}
```

**处理流程：**

1. 校验 skill_id 存在且 `source === 'user-created'`
2. 安全扫描新内容
3. 写入 `.pending/{name}/SKILL.md`
4. 记录到 `.skill-approvals.json`，状态 `pending_update`，包含旧内容快照
5. SSE 推送审批通知
6. 返回：`{ skillId, status: "pending_update" }`

**约束：**

- 不能修改系统 Skill 和示例 Skill（source !== 'user-created'）
- 保留 changelog 历史（最多 10 条）

#### `propose_skill`

Agent 发现模式但不确定是否值得创建 Skill 时，向用户推荐。

**输入参数：**

```typescript
{
  name: string;
  description: string;
  reason: string;  // 推荐理由：为什么这个模式值得创建 Skill
}
```

**处理流程：**

1. SSE 推送推荐通知（包含 reason）
2. 返回：`{ status: "proposed", message: "已向用户推荐创建此 Skill" }`

用户在 UI 中选择：
- 「创建」→ 预填 name/description → 用户补充 instructions → 进入 `create_skill` 流程
- 「忽略」→ 记录到 Memory 作为已拒绝的提议

### 3.2 用户审批流程

#### 状态模型

```
pending → approved → active
pending → rejected
pending_update → approved → active（旧版本归档）
pending_update → rejected → 恢复原版本
```

#### 审批状态持久化

文件：`user-skills/.skill-approvals.json`

```typescript
interface SkillApproval {
  id: string;              // 审批记录 ID
  skillName: string;
  type: 'create' | 'update';
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;     // ISO timestamp
  reviewedAt?: string;
  contentSnapshot: string; // 提交时的 instructions 快照
  oldContentSnapshot?: string; // update 时的旧内容
  patchDescription?: string;   // update 时的改动说明
  agentId?: string;        // 提交的 Agent
}
```

#### 审批服务

`SkillApprovalService`（新增，在 `skill` 模块内）：

- `submit(skillName, type, content, options)` — 创建审批记录
- `approve(approvalId)` — 审批通过，移动文件到正式目录，刷新索引
- `reject(approvalId, reason?)` — 审批拒绝，删除临时文件
- `listPending()` — 获取所有 pending 记录
- `getHistory(skillName)` — 获取某个 Skill 的审批历史

文件操作遵循原子写入：先写 tempfile，再 `fs.rename`。

#### SSE 通知格式

当 Agent 调用 `create_skill` / `update_skill` 时，SSE 流中插入审批事件：

```json
{
  "type": "skill_approval",
  "data": {
    "approvalId": "uuid",
    "skillName": "git-workflow",
    "type": "create",
    "description": "标准化 Git 工作流操作",
    "agentId": "ani"
  }
}
```

#### 前端审批 UI

SkillsView 新增「待审批」tab（与「全部」「已安装」并列）：

- Pending 列表：展示 name、description、提交 Agent、提交时间
- 操作按钮：通过（绿色）/ 拒绝（红色）/ 编辑后通过（蓝色）
- 编辑模式：内联 Markdown 编辑器，修改 instructions 后提交
- 通过后自动刷新 Skill 列表
- 实时更新：监听 SSE `skill_approval` 事件

ChatView 中也可展示审批通知：
- 聊天区域顶部浮现通知条（可展开查看详情）
- 「查看详情」跳转到 SkillsView 审批 tab

### 3.3 基础安全扫描

`SkillScanService`（新增，在 `skill` 模块内），Phase 1 检测：

```typescript
interface ScanResult {
  safe: boolean;
  threats: ScanThreat[];
}

interface ScanThreat {
  type: string;      // 'path_traversal' | 'code_injection' | 'size_exceeded' | 'invalid_yaml'
  severity: 'error' | 'warning';
  message: string;
  location?: string; // 在内容中的位置描述
}
```

**检测项：**

| 威胁类型 | 检测规则 | 严重级别 |
|----------|----------|----------|
| 路径遍历 | `../`, 绝对路径 (`/etc/`, `C:\`) | error |
| 代码注入 | `<script>`, `javascript:`, `eval(`, `exec(`, `system(` | error |
| 大小超限 | instructions > 64KB | error |
| YAML 格式 | frontmatter 解析失败、必填字段缺失 | error |
| 可疑命令 | `rm -rf`, `del /s`, `format` | warning |

扫描在审批通过前执行。`error` 级别威胁直接拒绝，`warning` 级别提示用户但允许通过。

### 3.4 使用量统计

扩展 `Skill` 接口：

```typescript
interface SkillUsage {
  useCount: number;
  viewCount: number;
  patchCount: number;
  lastUsedAt: string | null;
  createdAt: string;
}
```

存储：`user-skills/.skill-usage.json`

```typescript
// Record<skillId, SkillUsage>
{
  "git-workflow": {
    "useCount": 12,
    "viewCount": 5,
    "patchCount": 2,
    "lastUsedAt": "2026-05-06T10:30:00Z",
    "createdAt": "2026-04-20T08:00:00Z"
  }
}
```

统计触发点：
- `lookup_skill` 调用成功 → `useCount++`
- `findOneSummary` 调用 → `viewCount++`
- `update_skill` 审批通过 → `patchCount++`

`SkillService` 启动时加载，内存维护，每 60 秒持久化一次（debounce）。

### 3.5 数据流

```
对话中 Agent 发现重复模式
  ↓
Agent 调用 create_skill(name, description, instructions)
  ↓
SkillScanService 扫描内容
  ├─ 不安全 → 返回错误，Agent 收到反馈
  └─ 安全 → 继续
  ↓
写入 user-skills/.pending/{name}/SKILL.md
  ↓
SkillApprovalService 创建 pending 记录
  ↓
SSE 推送 skill_approval 事件
  ↓
前端 SkillsView 展示待审批条目
  ↓
用户操作：通过 / 拒绝 / 编辑后通过
  ↓
通过：
  原子移动到 user-skills/{name}/SKILL.md
  → SkillService.refresh() 重建索引
  → 新 Skill 可被 lookup_skill 检索
  → Agent 在后续对话中可使用
```

### 3.6 Agent Prompt 调整

当 Agent 拥有 `create_skill` / `update_skill` 工具时，system prompt 附加：

```
<skill_creation_guidance>
When you notice a reusable pattern in the conversation (e.g., the user repeatedly asks for the same type of task), consider creating a Skill:
- Use create_skill to save the pattern as a reusable instruction
- Skills are subject to user approval before becoming active
- Name skills in kebab-case (e.g., "git-workflow", "code-review-checklist")
- Keep instructions focused: one skill, one purpose
- If unsure whether a pattern is worth saving, use propose_skill to suggest it
</skill_creation_guidance>
```

## 4. Phase 2：智能检索 + 条件激活

### 4.1 Fuzzy Match 引擎

当 `lookup_skill` 精确匹配未命中时，触发模糊匹配链：

```
精确匹配（name + aliases）
  → 关键词拆分子集匹配
  → 编辑距离容错（≤ 2）
  → description 语义关键词匹配
  → 返回 top-3 候选
```

`lookup_skill` 工具行为变更：

```typescript
// 精确匹配
const exact = findByName(query);
if (exact) return exact;

// 模糊匹配
const candidates = fuzzyMatch(query, allSkills);
if (candidates.length > 0) {
  return {
    matched: false,
    candidates: candidates.slice(0, 3),
    message: `No exact match for "${query}". Did you mean one of these?`
  };
}
```

YAML frontmatter 新增 `aliases` 字段：

```yaml
name: git-workflow
aliases: ["git", "版本控制", "commit"]
```

### 4.2 条件激活

YAML frontmatter 新增条件字段：

```yaml
requires:
  tools: ["web_search"]        # 运行时需要的工具
  env: ["GITHUB_TOKEN"]        # 需要的环境变量
  platforms: ["mac", "linux"]  # 平台限制
fallback_for: ["web_search"]   # 当指定工具不可用时激活
```

`buildSkillIndex()` 变更：

1. 构建索引时检查 `requires` 条件
2. 当前环境不满足的 Skill 标记为 `inactive`
3. 注入 prompt 时只包含 `active` Skill
4. `fallback_for`：当指定工具不可用时，对应 Skill 自动激活

### 4.3 二层缓存

#### L1：内存 LRU

```typescript
class SkillCache {
  private lru = new Map<string, { content: string; expiry: number }>();
  private maxSize = 50;
  private ttlMs = 5 * 60 * 1000; // 5 minutes

  get(key: string): string | null;
  set(key: string, content: string): void;
  invalidate(key: string): void;
  invalidateAll(): void;
}
```

#### L2：磁盘 manifest

```json
// user-skills/.cache-manifest.json
{
  "git-workflow": {
    "mtime": "2026-05-06T10:00:00Z",
    "size": 2048,
    "hash": "sha256:abc..."
  }
}
```

`SkillService.findAllSummary()` 启动流程：

1. 加载 manifest
2. 对比每个 Skill 文件的 mtime + size
3. 有变化的 Skill 重新解析，无变化的从缓存读取
4. 更新 manifest

`refresh` 命令（`POST /api/v1/skills/refresh`）强制失效全部缓存。

## 5. Phase 3：自我改进 + Curator

### 5.1 经验提取

`SkillExperienceService`（新增）：

对话结束后异步分析 Skill 使用情况：

```typescript
interface SkillExperience {
  skillId: string;
  conversationId: string;
  outcome: 'success' | 'failure' | 'partial';
  failureReason?: string;   // 用户重新提问 / 换用其他方式 / Agent 自行重试
  userFeedback?: string;    // 来自 Memory 的用户反馈
  timestamp: string;
}
```

经验提取信号：
- Skill 调用后用户立即重新提问（failure）
- Skill 调用后用户满意（success）
- Skill 调用但 Agent 后续自行换用其他方式（partial）

### 5.2 自动 Patch

基于经验累积触发：

```
Skill 经验记录 ≥ 3 次相似 failure
  → Agent 在下次对话中主动建议 update_skill
  → Patch 内容基于 failure pattern 生成
  → 仍需用户审批
```

Patch changelog 记录：

```markdown
---
name: git-workflow
version: 1.1.0
---
...（instructions 内容）

<!-- changelog
## v1.1.0 (2026-05-10)
- 修复：处理 merge conflict 时缺少 abort 方案（基于 3 次失败经验）

## v1.0.0 (2026-05-06)
- 初始版本
changelog -->
```

用户可查看 changelog 并回滚到任意版本（最多保留 10 个版本快照）。

### 5.3 Curator 生命周期

```
active (正常使用)
  ↓ 30 天未使用
stale (标记为过时)
  ↓ 再 30 天 / 用户手动
archived (归档，不参与索引但仍可查看)
  ↓ 用户确认
deleted (彻底删除)
```

Curator 作为定时任务运行（复用现有定时任务系统）：
- 每天检查一次 Skill 使用统计
- `stale` → `archived` 自动执行
- `archived` → `deleted` 需用户确认

### 5.4 完整安全扫描

扩展 `SkillScanService` 检测模式至 90+：

- 新增：symlink 转义检测、环境变量泄露、网络请求检测
- 信任等级：`trusted`（系统/审批通过）→ `review`（待审）→ `untrusted`（外部来源）
- 不同信任等级对应不同的扫描严格度

## 6. 与现有系统的集成点

### 6.1 与 Memory 系统的边界

| 维度 | Skill | Memory |
|------|-------|--------|
| 内容 | 怎么做（how-to 知识） | 是什么（事实/偏好） |
| 来源 | Agent 创建 / 外部安装 | 对话中提取 / 用户设定 |
| 作用域 | Agent 共享或指定 Agent | agent_id 隔离 + 全局 |
| 生命周期 | active → stale → archived → deleted | 永久（手动删除） |
| 格式 | SKILL.md (YAML + Markdown) | DB 记录 |
| 检索 | lookup_skill（关键词） | 语义检索（embedding） |

交互：Agent Patch Skill 时可引用 Memory 中的用户反馈作为输入，但存储和检索完全独立。

### 6.2 与定时任务系统的集成

Phase 3 Curator 复用现有定时任务系统：
- 注册一个系统定时任务 `skill-curator`
- 每天执行一次生命周期检查
- 使用全局通知机制提醒用户处理 stale Skill

### 6.3 与 Agent 权限系统的集成

- `create_skill` / `update_skill` 工具默认仅 Ani（Supervisor）可用
- 其他 Agent 通过 Ani 路由间接使用
- 工具注册到 `ToolRegistryService`，category: `'skill'`
- 权限分级：系统 Agent 自动拥有，自定义 Agent 需在配置中显式启用

## 7. API 设计

### 新增 REST Endpoints

```
GET    /api/v1/skills/approvals          # 获取待审批列表
POST   /api/v1/skills/approvals/:id/approve   # 审批通过
POST   /api/v1/skills/approvals/:id/reject    # 审批拒绝
GET    /api/v1/skills/:id/usage          # 获取使用统计
GET    /api/v1/skills/:id/changelog      # 获取变更历史
POST   /api/v1/skills/:id/rollback       # 回滚到指定版本
```

### SSE 事件

```
skill_approval    # 新 Skill 待审批通知
skill_approved    # Skill 审批通过（Agent 可感知）
skill_rejected    # Skill 审批拒绝
```

## 8. 文件结构变更

```
backend/src/modules/skill/
  ├── skill.service.ts              # 现有，扩展缓存和统计
  ├── skill.types.ts                # 现有，扩展接口
  ├── skill.controller.ts           # 现有，新增审批 endpoints
  ├── skill-approval.service.ts     # 新增：审批流程管理
  ├── skill-scan.service.ts         # 新增：安全扫描
  ├── skill-usage.service.ts        # 新增：使用量统计
  ├── skill-experience.service.ts   # Phase 3：经验提取
  └── tools/
      ├── skill-lookup.tool.ts      # 现有，扩展模糊匹配
      ├── create-skill.tool.ts      # 新增
      ├── update-skill.tool.ts      # 新增
      └── propose-skill.tool.ts     # 新增

user-skills/
  ├── .pending/                     # 待审批 Skill
  │   └── {name}/SKILL.md
  ├── .archive/                     # 归档 Skill
  │   └── {name}/SKILL.md
  ├── .skill-approvals.json         # 审批状态
  ├── .skill-usage.json             # 使用统计
  ├── .skill-experience.json        # Phase 3：经验记录
  ├── .cache-manifest.json          # Phase 2：缓存清单
  ├── {name}/                       # 正式 Skill
  │   ├── SKILL.md
  │   └── .versions/                # Phase 3：版本快照
  │       └── v1.0.0.md
  └── ...

frontend/src/views/SkillsView.vue   # 扩展审批 tab
frontend/src/composables/useSkillApproval.ts  # 新增：审批状态管理
```

## 9. 风险与缓解

| 风险 | 缓解 |
|------|------|
| Agent 滥用创建 Skill | 单次对话上限 3 个，仅 Ani 可直接调用 |
| 恶意内容注入 | 基础扫描 + 用户审批双重保障 |
| Skill 质量低 | 使用量统计 + 经验提取 → 自动 Patch 改进 |
| 文件系统并发写入 | 原子写入（tempfile + rename） |
| 审批状态丢失 | `.skill-approvals.json` 每次操作后立即持久化 |
| Skill 数量膨胀 | Phase 3 Curator 自动归档不活跃 Skill |
