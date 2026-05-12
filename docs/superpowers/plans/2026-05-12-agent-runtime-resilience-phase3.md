# Agent Runtime 韧性优化 — Phase 3 成本优化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Token 使用量追踪 + 模型路由（轻量模型处理简单任务）+ Prompt Cache 结构确认。

**Architecture:** 新增 `TokenUsageEntity` 记录每次 LLM 调用的 token 消耗，`StreamEvent` 扩展携带 usage 数据；`AppConfigService` 新增 `lightModel`/`mediumModel` 配置，标题生成和 memory 提取路由到轻量模型。

**Tech Stack:** NestJS、TypeORM、LangChain ChatOpenAI

---

## File Structure

| 操作 | 文件 | 职责 |
|------|------|------|
| Create | `backend/src/common/entities/token-usage.entity.ts` | Token 使用量实体 |
| Create | `backend/src/modules/chat/token-usage.service.ts` | Token 使用量追踪服务 |
| Modify | `backend/src/config/config.service.ts` | 新增 lightModel / mediumModel 配置 |
| Modify | `backend/src/modules/langgraph/langgraph.service.ts` | StreamEvent 扩展 usage，提取 response_metadata |
| Modify | `backend/src/modules/chat/chat.service.ts` | 标题生成用轻量模型，流结束后记录 token 使用量 |
| Modify | `backend/src/modules/chat/chat.module.ts` | 注册 TokenUsageEntity 和 TokenUsageService |
| Modify | `backend/.env.example` | 新增 LIGHT_MODEL / MEDIUM_MODEL |

---

### Task 1: Token Usage Entity

**Files:**
- Create: `backend/src/common/entities/token-usage.entity.ts`

- [ ] **Step 1: 创建 TokenUsageEntity**

```typescript
import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('token_usages')
export class TokenUsageEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  @Index()
  session_id: string;

  @Column({ nullable: true })
  agent_id: string;

  @Column()
  model_name: string;

  @Column('int')
  prompt_tokens: number;

  @Column('int')
  completion_tokens: number;

  @Column('int')
  total_tokens: number;

  @Column('decimal', { precision: 10, scale: 6, nullable: true })
  estimated_cost: number;

  @CreateDateColumn()
  @Index()
  created_at: Date;
}
```

- [ ] **Step 2: 验证**

```bash
cd backend && pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/common/entities/token-usage.entity.ts
git commit -m "feat(usage): add TokenUsageEntity for cost tracking"
```

---

### Task 2: Config 轻量/中等模型配置

**Files:**
- Modify: `backend/src/config/config.service.ts`
- Modify: `backend/.env.example`

- [ ] **Step 1: 在 AppConfigService 中新增 lightModel 和 mediumModel getter**

在 `llmTimeoutMs` getter 后追加：

```typescript
  get lightModel(): string {
    return this.configService.get<string>('LIGHT_MODEL', '');
  }

  get mediumModel(): string {
    return this.configService.get<string>('MEDIUM_MODEL', '');
  }
```

- [ ] **Step 2: 更新 .env.example**

在 `LLM_TIMEOUT_MS=30000` 后追加：

```
# 模型路由（可选，留空则使用 OPENAI_MODEL）
LIGHT_MODEL=
MEDIUM_MODEL=
```

- [ ] **Step 3: 验证**

```bash
cd backend && pnpm lint
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/config/config.service.ts backend/.env.example
git commit -m "feat(config): add LIGHT_MODEL and MEDIUM_MODEL config getters"
```

---

### Task 3: Token Usage 追踪服务

**Files:**
- Create: `backend/src/modules/chat/token-usage.service.ts`

- [ ] **Step 1: 创建 TokenUsageService**

```typescript
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { TokenUsageEntity } from '../../common/entities/token-usage.entity';

/** 各模型每 1M tokens 单价（USD） */
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'gpt-4.1-nano': { input: 0.1, output: 0.4 },
  'qwen-max': { input: 2.4, output: 9.6 },
  'qwen-plus': { input: 0.8, output: 2 },
  'qwen-turbo': { input: 0.3, output: 0.6 },
  'deepseek-chat': { input: 0.27, output: 1.1 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },
};

@Injectable()
export class TokenUsageService {
  constructor(
    @InjectRepository(TokenUsageEntity)
    private usageRepo: Repository<TokenUsageEntity>,
  ) {}

  /** 计算估算成本（USD） */
  calculateCost(modelName: string, promptTokens: number, completionTokens: number): number | null {
    const pricing = MODEL_PRICING[modelName];
    if (!pricing) return null;
    return (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000;
  }

  /** 记录一次 token 使用 */
  async record(params: {
    sessionId: string;
    agentId?: string;
    modelName: string;
    promptTokens: number;
    completionTokens: number;
  }): Promise<TokenUsageEntity> {
    const { sessionId, agentId, modelName, promptTokens, completionTokens } = params;
    const totalTokens = promptTokens + completionTokens;
    const estimatedCost = this.calculateCost(modelName, promptTokens, completionTokens);

    const entity = this.usageRepo.create({
      id: uuidv4(),
      session_id: sessionId,
      agent_id: agentId || null,
      model_name: modelName,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      estimated_cost: estimatedCost,
    });

    return this.usageRepo.save(entity);
  }

  /** 聚合查询：按时间范围统计 */
  async getStats(params: {
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'model' | 'agent' | 'day';
  }) {
    const qb = this.usageRepo.createQueryBuilder('u');

    if (params.startDate) {
      qb.andWhere('u.created_at >= :startDate', { startDate: params.startDate });
    }
    if (params.endDate) {
      qb.andWhere('u.created_at < :endDate', { endDate: params.endDate });
    }

    const groupBy = params.groupBy || 'model';

    if (groupBy === 'model') {
      qb.select('u.model_name', 'model_name')
        .addSelect('SUM(u.prompt_tokens)', 'total_prompt_tokens')
        .addSelect('SUM(u.completion_tokens)', 'total_completion_tokens')
        .addSelect('SUM(u.total_tokens)', 'total_tokens')
        .addSelect('SUM(u.estimated_cost)', 'total_cost')
        .addSelect('COUNT(u.id)', 'request_count')
        .groupBy('u.model_name');
    } else if (groupBy === 'agent') {
      qb.select('u.agent_id', 'agent_id')
        .addSelect('SUM(u.total_tokens)', 'total_tokens')
        .addSelect('SUM(u.estimated_cost)', 'total_cost')
        .addSelect('COUNT(u.id)', 'request_count')
        .groupBy('u.agent_id');
    } else if (groupBy === 'day') {
      qb.select("DATE(u.created_at)", 'date')
        .addSelect('SUM(u.total_tokens)', 'total_tokens')
        .addSelect('SUM(u.estimated_cost)', 'total_cost')
        .addSelect('COUNT(u.id)', 'request_count')
        .groupBy('date')
        .orderBy('date', 'ASC');
    }

    return qb.getRawMany();
  }
}
```

- [ ] **Step 2: 验证**

```bash
cd backend && pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/chat/token-usage.service.ts
git commit -m "feat(usage): add TokenUsageService with cost calculation and stats"
```

---

### Task 4: StreamEvent 扩展 usage 数据

**Files:**
- Modify: `backend/src/modules/langgraph/langgraph.service.ts`

- [ ] **Step 1: 扩展 StreamEvent 类型**

在 `StreamEvent` 类型联合的 `finish` 分支中，添加 usage 字段：

将：
```typescript
  | { type: 'finish'; finishReason: string };
```

替换为：
```typescript
  | {
      type: 'finish';
      finishReason: string;
      usage?: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      };
      modelName?: string;
    };
```

- [ ] **Step 2: 在 chatStream 中提取 usage_metadata**

找到 chatStream 方法末尾正常结束的 `yield { type: 'finish', finishReason: 'stop' }` 附近。

需要在 `response_metadata` 检测位置（约 line 563）附近提取 usage 信息，并在最终的 finish yield 中携带。

具体步骤：

a) 在 chatStream 方法开头添加变量：
```typescript
let streamUsage: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined;
let streamModelName: string | undefined;
```

b) 在检测 `response_metadata` 的位置（约 line 562-570），追加 usage 提取：
```typescript
        // response_metadata 表示 AI chunk 流结束
        if ((aiMsg as any).response_metadata) {
          // 提取 token usage
          const meta = (aiMsg as any).response_metadata;
          const usageMeta = meta?.tokenUsage || meta?.usage;
          if (usageMeta) {
            streamUsage = {
              promptTokens: usageMeta.promptTokens || usageMeta.prompt_tokens || 0,
              completionTokens: usageMeta.completionTokens || usageMeta.completion_tokens || 0,
              totalTokens: usageMeta.totalTokens || usageMeta.total_tokens || 0,
            };
          }
          if (meta?.model_name) {
            streamModelName = meta.model_name;
          }

          for (const [tcId, tc] of toolCalls) {
            if (!tc.inputEmitted) {
              tc.inputEmitted = true;
              yield* emitToolInput(tcId, tc);
            }
          }
        }
```

c) 将末尾的 finish yield 替换为携带 usage 的版本：
```typescript
    yield {
      type: 'finish',
      finishReason: 'stop',
      usage: streamUsage,
      modelName: streamModelName || this.configService.openaiModel,
    };
```

d) 同样更新其他两个 finish yield（repeated_handoff 和 max_handoffs_exceeded）也携带 modelName：

```typescript
    yield { type: 'finish', finishReason: 'repeated_handoff', modelName: this.configService.openaiModel };
```

```typescript
    yield { type: 'finish', finishReason: 'max_handoffs_exceeded', modelName: this.configService.openaiModel };
```

- [ ] **Step 3: 验证**

```bash
cd backend && pnpm lint
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/langgraph/langgraph.service.ts
git commit -m "feat(langgraph): extract usage_metadata from stream finish events"
```

---

### Task 5: ChatModule 注册 + Token 使用量记录

**Files:**
- Modify: `backend/src/modules/chat/chat.module.ts`
- Modify: `backend/src/modules/chat/chat.service.ts`

- [ ] **Step 1: 更新 chat.module.ts**

将 `TokenUsageEntity` 加入 TypeOrmModule.forFeature，并注册 `TokenUsageService`：

在 imports 区域添加 TokenUsageEntity：
```typescript
imports: [
    TypeOrmModule.forFeature([SessionEntity, MessageEntity, TokenUsageEntity]),
```

添加 import：
```typescript
import { TokenUsageEntity } from '../../common/entities/token-usage.entity';
import { TokenUsageService } from './token-usage.service';
```

在 providers 和 exports 中添加 TokenUsageService：
```typescript
providers: [ChatService, AppConfigService, TokenUsageService],
exports: [ChatService, TokenUsageService],
```

- [ ] **Step 2: 在 chat.service.ts 中注入 TokenUsageService 并记录 usage**

a) 添加 import：
```typescript
import { TokenUsageService } from './token-usage.service';
```

b) 在 constructor 中注入：
```typescript
    private tokenUsageService: TokenUsageService,
```

c) 在 `streamCompletion` 方法中，找到处理 `finish` 事件的 case（约 line 196-198），修改为：

```typescript
          case 'finish':
            yield { event: 'message_done', data: { ...base, finish_reason: event.finishReason } };
            // 异步记录 token 使用量
            if (event.usage && event.usage.totalTokens > 0) {
              this.tokenUsageService.record({
                sessionId,
                agentId: preferredAgent,
                modelName: event.modelName || '',
                promptTokens: event.usage.promptTokens,
                completionTokens: event.usage.completionTokens,
              }).catch(() => {});
            }
            break;
```

- [ ] **Step 3: 验证**

```bash
cd backend && pnpm lint
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/modules/chat/chat.module.ts backend/src/modules/chat/chat.service.ts
git commit -m "feat(chat): integrate TokenUsageService, record usage on stream finish"
```

---

### Task 6: 模型路由 — 标题生成用轻量模型

**Files:**
- Modify: `backend/src/modules/chat/chat.service.ts`

- [ ] **Step 1: 修改 generateTitleIfNeeded 使用轻量模型**

将 `generateTitleIfNeeded` 方法中创建 ChatOpenAI 实例的部分：

```typescript
      const model = new ChatOpenAI({
        modelName: this.configService.openaiModel,
```

替换为：

```typescript
      const model = new ChatOpenAI({
        modelName: this.configService.lightModel || this.configService.openaiModel,
```

- [ ] **Step 2: 验证**

```bash
cd backend && pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/chat/chat.service.ts
git commit -m "feat(chat): route title generation to light model when configured"
```

---

### Task 7: Usage API 端点

**Files:**
- Modify: `backend/src/modules/chat/chat.controller.ts`

- [ ] **Step 1: 添加 Usage 查询端点**

在 ChatController 中添加：

a) 注入 TokenUsageService（在 constructor 中添加参数）：
```typescript
    private tokenUsageService: TokenUsageService,
```

添加 import：
```typescript
import { TokenUsageService } from './token-usage.service';
```

b) 添加查询端点（在现有路由后追加）：

```typescript
  @Get('usage')
  async getUsage(
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
    @Query('group_by') groupBy?: 'model' | 'agent' | 'day',
  ) {
    return this.tokenUsageService.getStats({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      groupBy: groupBy || 'model',
    });
  }
```

需要添加 `@Get` 和 `@Query` 的 import（检查 `@nestjs/common` 是否已有）。

- [ ] **Step 2: 验证**

```bash
cd backend && pnpm lint
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/chat/chat.controller.ts
git commit -m "feat(chat): add GET /usage API endpoint for token usage stats"
```

---

### Task 8: 端到端冒烟验证

- [ ] **Step 1: 重启后端**

```bash
cd backend && pnpm dev
```

Expected: 0 编译错误，token_usages 表自动创建

- [ ] **Step 2: 发送消息验证正常对话**

```bash
curl -sk -X POST http://localhost:8000/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"message":"你好，简短回复","stream":false}'
```

Expected: 正常回复

- [ ] **Step 3: 验证 usage API**

```bash
curl -sk http://localhost:8000/api/v1/chat/usage?group_by=model
```

Expected: 返回 JSON 数组（可能为空，因为非 stream 请求未记录 usage）

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: Phase 3 cost optimization complete — smoke test passed"
```

---

## Self-Review

### 1. Spec Coverage

| Spec 要求 | 对应 Task |
|-----------|----------|
| token_usage 表结构 | Task 1 |
| prompt_tokens / completion_tokens / total_tokens / estimated_cost | Task 1 |
| 成本计算（各模型单价表） | Task 3 |
| 从 AIMessage.usage_metadata 提取 usage | Task 4 |
| LIGHT_MODEL / MEDIUM_MODEL 配置 | Task 2 |
| 标题生成路由到轻量模型 | Task 6 |
| Memory 提取路由到轻量模型 | Phase 3 spec 提到，但当前系统无 extractMemories 方法，跳过 |
| Supervisor 路由到中等模型（可选） | 不做，过度工程 |
| Prompt Cache 结构（对话级别） | Phase 2 已完成，此 Phase 仅确认 |
| 前端用量看板 | 不做，通过 API 暴露数据即可 |

### 2. Placeholder Scan

无 TBD/TODO。

### 3. Type Consistency

- `TokenUsageEntity.estimated_cost: number` (decimal) ↔ `TokenUsageService.calculateCost()` 返回 `number | null` — 一致
- `StreamEvent` 的 `finish` 分支新增 `usage?` 和 `modelName?` 字段，chat.service.ts 的 switch case 可正常解构 — 一致
- `TokenUsageService.record()` 的 `agentId?: string` 参数来自 `preferredAgent?: string` — 类型兼容
- `TokenUsageEntity` 使用 `autoLoadEntities: true` 自动注册，无需手动添加到 AppModule — 一致
