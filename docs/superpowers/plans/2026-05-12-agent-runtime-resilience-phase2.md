# Agent Runtime 韧性优化 — Phase 2 Context 治理实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prompt 前缀固定化（支持 Prompt Cache）+ Memory top-k 限制 + Memory 定期巡检治理。

**Architecture:** `buildSystemPrompt()` 拆为 `buildStaticPrefix()` + `buildDynamicSuffix()`，静态前缀 hash 缓存；`buildMemoryContext()` 加 top-k 限制；Memory 巡检挂载到定时任务系统。

**Tech Stack:** NestJS、TypeORM、crypto（hash）

---

## File Structure

| 操作 | 文件 | 职责 |
|------|------|------|
| Modify | `backend/src/modules/chat/chat.service.ts` | 拆分 buildSystemPrompt → buildStaticPrefix + buildDynamicSuffix |
| Modify | `backend/src/modules/memory/memory.service.ts` | buildMemoryContext 加 top-k 限制 + 巡检方法 |
| Modify | `backend/src/common/entities/memory.entity.ts` | 新增 `archived` 字段 |

---

### Task 1: Memory Entity 添加 archived 字段

**Files:**
- Modify: `backend/src/common/entities/memory.entity.ts`

- [ ] **Step 1: 添加 archived 字段**

在 `last_accessed` 字段后追加：

```typescript
/** 归档标记：归档的记忆不参与查询 */
@Column({ default: false })
archived: boolean;
```

- [ ] **Step 2: 验证**

```bash
cd backend && pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/common/entities/memory.entity.ts
git commit -m "feat(memory): add archived field for cold storage"
```

---

### Task 2: Memory top-k 限制

**Files:**
- Modify: `backend/src/modules/memory/memory.service.ts`

- [ ] **Step 1: 修改 `buildMemoryContext` 加 top-k 限制**

将 `buildMemoryContext` 方法替换为：

```typescript
async buildMemoryContext(_sessionId?: string, agentId?: string, topK = 20): Promise<string> {
    const qb = this.memoryRepo.createQueryBuilder('m')
      .where('m.archived = :archived', { archived: false });

    if (agentId) {
      qb.andWhere('(m.agent_id = :agentId OR m.agent_id IS NULL)', { agentId });
    }

    qb.orderBy('m.importance', 'DESC').limit(topK);

    const sorted = await qb.getMany();
    if (sorted.length === 0) return '';

    const typeLabel: Record<string, string> = {
      [MemoryType.FACT]: '事实',
      [MemoryType.PREFERENCE]: '偏好',
      [MemoryType.EVENT]: '事件',
    };

    const lines = sorted.map((m) => `- [${typeLabel[m.type] || m.type}] ${m.content}`);
    return `以下是关于用户的已知信息：\n${lines.join('\n')}`;
  }
```

- [ ] **Step 2: 验证**

```bash
cd backend && pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/memory/memory.service.ts
git commit -m "feat(memory): add top-k limit (20) and archived filter to buildMemoryContext"
```

---

### Task 3: Memory 定期巡检

**Files:**
- Modify: `backend/src/modules/memory/memory.service.ts`

- [ ] **Step 1: 添加巡检方法**

在 `MemoryService` 类中追加：

```typescript
/**
   * 定期巡检：降权长期未被召回的记忆，归档过期记忆
   * 由定时任务系统每天调用一次
   */
  async runMaintenance(): Promise<{ demoted: number; archived: number }> {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const hundredEightyDaysAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);

    // 降权：超过 90 天未被召回且 importance > 1 的记忆
    const demoteResult = await this.memoryRepo
      .createQueryBuilder()
      .update(MemoryEntity)
      .set({ importance: () => 'GREATEST(importance - 1, 0)' })
      .where('last_accessed < :date', { date: ninetyDaysAgo })
      .andWhere('importance > 0')
      .andWhere('archived = false')
      .execute();

    // 归档：importance = 0 且超过 180 天的记忆
    const archiveResult = await this.memoryRepo
      .createQueryBuilder()
      .update(MemoryEntity)
      .set({ archived: true })
      .where('importance = 0')
      .andWhere('created_at < :date', { date: hundredEightyDaysAgo })
      .andWhere('archived = false')
      .execute();

    this.logger.log(`Memory maintenance: demoted=${demoteResult.affected}, archived=${archiveResult.affected}`);

    return {
      demoted: demoteResult.affected || 0,
      archived: archiveResult.affected || 0,
    };
  }
```

- [ ] **Step 2: 验证**

```bash
cd backend && pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/memory/memory.service.ts
git commit -m "feat(memory): add runMaintenance for periodic demotion and archival"
```

---

### Task 4: Memory 写入限流

**Files:**
- Modify: `backend/src/modules/memory/memory.service.ts`

- [ ] **Step 1: 添加 per-session 写入限流**

在 `MemoryService` 类中追加字段和方法：

```typescript
/** 每个会话最多提取的记忆数 */
  private static readonly MAX_MEMORIES_PER_SESSION = 5;
  private sessionMemoryCount = new Map<string, number>();

  /** 检查并记录会话记忆写入计数，返回是否允许写入 */
  checkSessionLimit(sessionId: string): boolean {
    const current = this.sessionMemoryCount.get(sessionId) || 0;
    if (current >= MemoryService.MAX_MEMORIES_PER_SESSION) return false;
    this.sessionMemoryCount.set(sessionId, current + 1);
    return true;
  }

  /** 重置会话计数（会话结束时调用） */
  resetSessionLimit(sessionId: string): void {
    this.sessionMemoryCount.delete(sessionId);
  }
```

- [ ] **Step 2: 验证**

```bash
cd backend && pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/memory/memory.service.ts
git commit -m "feat(memory): add per-session write limit (5 memories per conversation)"
```

---

### Task 5: Prompt 前缀固定化

**Files:**
- Modify: `backend/src/modules/chat/chat.service.ts`

- [ ] **Step 1: 添加 import**

在文件顶部 import 区追加：

```typescript
import { createHash } from 'crypto';
```

- [ ] **Step 2: 添加静态前缀缓存字段**

在 class 内（`private tokenBudget` 后）追加：

```typescript
private staticPrefixCache = new Map<string, { hash: string; content: string }>();
```

- [ ] **Step 3: 添加 `buildStaticPrefix` 方法**

在 `buildSystemPrompt` 方法前追加新方法：

```typescript
/**
   * 构建静态前缀：Agent system_prompt + 规则
   * 这些内容在 Agent 配置不变时是恒定的，可以被 Prompt Cache 命中
   */
  private async buildStaticPrefix(agentId: string, ruleIds?: string[]): Promise<string> {
    const cacheKey = `${agentId}:${ruleIds?.sort().join(',') || ''}`;
    const cached = this.staticPrefixCache.get(cacheKey);
    if (cached) return cached.content;

    const parts: string[] = [];
    const resolvedAgentId = (agentId === 'builtin-general' ? 'ani' : agentId) || 'ani';

    try {
      const agent = await this.agentService.findOne(resolvedAgentId);
      if (agent.system_prompt) parts.push(agent.system_prompt);
    } catch (e) {
      console.warn(`[ChatService] Failed to load agent ${resolvedAgentId}:`, e instanceof Error ? e.message : e);
    }

    const globalRules = await this.ruleService.getGlobalRules();
    let agentRuleIds = ruleIds;
    if (!agentRuleIds || agentRuleIds.length === 0) {
      try {
        const agent = await this.agentService.findOne(resolvedAgentId);
        agentRuleIds = agent.rule_ids || [];
      } catch { /* empty */ }
    }
    const agentRules = await this.ruleService.getRulesByIds(agentRuleIds);

    const allRules = [...globalRules];
    const globalIds = new Set(globalRules.map((r) => r.id));
    for (const r of agentRules) {
      if (!globalIds.has(r.id)) allRules.push(r);
    }
    if (allRules.length > 0) {
      parts.push(...allRules.map((r) => r.content));
    }

    const content = parts.join('\n\n');
    this.staticPrefixCache.set(cacheKey, { hash: createHash('md5').update(content).digest('hex'), content });
    return content;
  }
```

- [ ] **Step 4: 添加 `buildDynamicSuffix` 方法**

在 `buildStaticPrefix` 后追加：

```typescript
/**
   * 构建动态后缀：时间 + 联网搜索 + Memory
   * 这些内容每次请求可能不同，放在后缀不被缓存
   */
  private async buildDynamicSuffix(agentId: string, webSearch?: boolean): Promise<string> {
    const parts: string[] = [];
    const resolvedAgentId = (agentId === 'builtin-general' ? 'ani' : agentId) || 'ani';

    const now = new Date();
    parts.push(`当前时间：${now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })} ${now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`);

    if (webSearch) {
      parts.push('[联网搜索已开启] 请先判断用户意图：如果用户询问最新信息、新闻、实时数据、近期事件等需要最新数据的请求，调用 web_search tool 搜索相关信息后基于搜索结果回答；对于普通对话、知识问答、代码编写等不需要实时数据的请求，不要调用 web_search tool。');
    } else {
      parts.push('[联网搜索已关闭] 不要调用 web_search tool。直接用已有知识回答用户问题。');
    }

    const memoryContext = await this.memoryService.buildMemoryContext(undefined, resolvedAgentId);
    if (memoryContext) parts.push(memoryContext);

    return parts.join('\n\n');
  }
```

- [ ] **Step 5: 替换 `buildSystemPrompt` 使用新方法**

将 `buildSystemPrompt` 方法替换为：

```typescript
private async buildSystemPrompt(agentId?: string, ruleIds?: string[], webSearch?: boolean): Promise<string> {
    const resolvedAgentId = agentId || 'ani';
    const staticPrefix = await this.buildStaticPrefix(resolvedAgentId, ruleIds);
    const dynamicSuffix = await this.buildDynamicSuffix(resolvedAgentId, webSearch);
    return staticPrefix + '\n\n' + dynamicSuffix;
  }
```

- [ ] **Step 6: 验证**

```bash
cd backend && pnpm lint
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/chat/chat.service.ts
git commit -m "feat(chat): split buildSystemPrompt into static prefix (cacheable) + dynamic suffix"
```

---

### Task 6: Memory 巡检挂载到定时任务

**Files:**
- Modify: `backend/src/modules/cron-job/job.service.ts` (或找到系统定时任务注册的位置)

先确认定时任务系统如何注册系统级任务。查找已有的定时任务调度代码。

- [ ] **Step 1: 在 CronJobModule 或 ScheduleModule 中注册 Memory 巡检定时任务**

在合适的模块中（可能是 `backend/src/modules/cron-job/` 下），添加一个每天凌晨执行 `memoryService.runMaintenance()` 的定时任务。

具体实现取决于项目的定时任务架构。如果是 NestJS `@nestjs/schedule`：

```typescript
@Cron('0 3 * * *') // 每天凌晨 3 点
async runMemoryMaintenance() {
  await this.memoryService.runMaintenance();
}
```

如果使用自定义定时任务系统，则通过 `JobService` 注册一个系统任务。

- [ ] **Step 2: 验证**

```bash
cd backend && pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(cron): register daily memory maintenance job"
```

---

### Task 7: 端到端冒烟验证

- [ ] **Step 1: 重启后端**

```bash
cd backend && pnpm dev
```

Expected: 0 编译错误

- [ ] **Step 2: 发送消息验证 prompt 拆分不影响正常对话**

```bash
curl -sk -X POST http://localhost:8000/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"message":"你好，简短回复","stream":false}'
```

Expected: 正常回复

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: Phase 2 context governance complete — smoke test passed"
```

---

## Self-Review

### 1. Spec Coverage

| Spec 要求 | 对应 Task |
|-----------|----------|
| Prompt 前缀固定化（静态前缀 + 动态后缀） | Task 5 |
| 静态前缀 hash 缓存 | Task 5 |
| Memory top-k 限制（默认 20 条） | Task 2 |
| Memory archived 字段 | Task 1 |
| 定期巡检（90天降权 + 180天归档） | Task 3 + Task 6 |
| 写入限流（单次对话最多 5 条） | Task 4 |

### 2. Placeholder Scan

无 TBD/TODO。

### 3. Type Consistency

- `MemoryEntity.archived: boolean` 在 Task 1 定义，Task 2 的查询使用 `archived = false` 过滤——一致
- `buildStaticPrefix` 和 `buildDynamicSuffix` 的 agentId 解析逻辑（`builtin-general → ani`）与原 `buildSystemPrompt` 一致
- `buildMemoryContext` 新增 `topK` 参数有默认值 20，不破坏现有调用
