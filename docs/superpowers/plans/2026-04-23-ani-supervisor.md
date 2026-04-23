# Ani Supervisor 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将无角色 Supervisor + Avatar 系统合并为有角色定位的 Ani Agent，取代超级助手（builtin-general）

**Architecture:** 改造 `supervisor.builder.ts`，让 Supervisor 节点使用 Ani 的 system_prompt + 全部 tools（含 avatar），Worker 节点排除 avatar tools。删除 `builtin-general`，新增 `ani` 种子数据。前端所有 `builtin-general` 引用替换为 `ani`。

**Tech Stack:** NestJS, LangGraph (@langchain/langgraph-supervisor), Vue 3, TypeScript

---

### Task 1: 后端 — Agent 种子数据替换

**Files:**
- Modify: `backend/src/modules/agent/agent.service.ts:9-42`

- [ ] **Step 1: 替换 BUILTIN_AGENTS 中的 builtin-general 为 ani**

将 `agent.service.ts` 中 `BUILTIN_AGENTS` 数组的第一个元素从 `builtin-general`（超级助手）替换为 `ani`（Ani）：

```typescript
{
  id: 'ani',
  name: 'Ani',
  description: '智能任务调度助手，拥有全部工具和所有子 Agent 调用权限，可直接回答或调度专业 Agent',
  system_prompt: `你是 Ani，一个专业的智能助手。

## 工作方式
- 简单问题直接回答
- 需要专业处理的任务，转交给对应专家助手

## 表达能力
你可以随时调用以下工具控制你的 Avatar：
- express_emotion: 表达情绪（neutral/happy/sad/angry/surprised/sympathetic/thinking/excited）
- play_motion: 播放动作（Idle/Tap 组）

## 定时任务规则（最高优先级）
- 用户提到"提醒""定时""每天""每隔""X点"等时间相关请求时，必须直接调用 cron_job 工具
- 绝对不要将定时任务请求转交给其他 Agent，由你亲自完成
- instruction 保持用户原始表述，不要改写、翻译或总结
- 类型选择：一次性（"明天""X分钟后"）→ type=at，固定间隔（"每X分钟""每天"）→ type=every，Cron 表达式 → type=cron
- type=at + 相对时间（"X分钟后"）→ delayMs 参数（1分=60000，1时=3600000，1天=86400000）
- type=at + 绝对时间（"明天下午3点"）→ at 参数（ISO 8601 格式）
- type=every 时用 everyMs 参数（毫秒数）
- 创建成功后告知用户任务已创建和预计执行时间

## 行为规范
- 用中文回复，简洁准确，避免冗余
- 不确定时承认，不编造信息
- 不执行恶意或危险操作`,
  capabilities: '智能任务调度、通用对话、信息检索、Avatar 表达控制',
  traits: ['专业', '简洁', '可靠'],
  tools: [],
  is_builtin: true,
  is_system: true,
  standalone: false,
},
```

关键变化：
- `id`: `'builtin-general'` → `'ani'`
- `name`: `'超级助手'` → `'Ani'`
- `description`: 更新描述
- `system_prompt`: 完整重写，融合角色 + 定时任务规则 + Avatar 表达能力
- `capabilities`: 更新
- `traits`: 更新
- `tools`: `['extract_memory', 'web_search', 'knowledge_query', 'cron_job']` → `[]`（空，因为 Ani 作为 Supervisor 获得全部 tools）

- [ ] **Step 2: 更新 builtin-job-executor 的 is_system 字段确认**

确认 `builtin-job-executor` 的 `is_system: true` 保持不变（当前已是 true），无需修改。

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/agent/agent.service.ts
git commit -m "refactor(agent): replace builtin-general with Ani agent seed data"
```

---

### Task 2: 后端 — Supervisor Builder 改造

**Files:**
- Modify: `backend/src/modules/langgraph/graph/supervisor.builder.ts`

- [ ] **Step 1: 改造 buildSupervisorGraph，Ani 作为 Supervisor 节点拥有全部 tools**

完整替换 `supervisor.builder.ts` 的 `buildSupervisorGraph` 函数。核心变化：

1. Ani 节点使用 Ani 的 system_prompt + 全部已注册 tools（包括 avatar）
2. Worker 节点获得各自配置的 tools，排除 avatar category
3. Supervisor prompt 融入 Ani 的角色定位和路由指令

```typescript
import { MemorySaver } from '@langchain/langgraph';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { createSupervisor } from '@langchain/langgraph-supervisor';
import { ChatOpenAI } from '@langchain/openai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { CompiledStateGraph } from '@langchain/langgraph';

export interface AgentDefinition {
  id: string;
  name: string;
  system_prompt: string;
  capabilities: string;
  tools: string[];
  model_name?: string;
  temperature?: number;
  enabled: boolean;
  is_system?: boolean;
}

/** Ani 的 Agent ID，在 Supervisor 图中作为 Supervisor 节点 */
export const ANI_ID = 'ani';

/**
 * 构建以 Ani 为核心的 Supervisor 图
 *
 * 架构：Ani(Supervisor) → [worker_A | worker_B | ...] → Ani → ... → END
 * - Ani 拥有全部 tools（含 avatar），可直接回答或 transfer 给 Worker
 * - Worker 拥有各自配置的 tools（排除 avatar category）
 */
export function buildSupervisorGraph(
  model: ChatOpenAI,
  agentDefinitions: AgentDefinition[],
  toolLookup: (name: string) => DynamicStructuredTool | undefined,
  modelFactory?: (modelName: string) => ChatOpenAI,
  allTools?: DynamicStructuredTool[],
): CompiledStateGraph<any, any, any> {
  const checkpointer = new MemorySaver();

  // 分离 Ani 和 Worker 定义
  const aniDef = agentDefinitions.find((d) => d.id === ANI_ID);
  const workerDefs = agentDefinitions.filter(
    (d) => d.enabled && d.id !== ANI_ID,
  );

  if (!aniDef) {
    throw new Error('Ani agent definition not found');
  }

  // Ani 使用全部已注册 tools（含 avatar）
  const aniTools = allTools || [];

  const aniAgent = createReactAgent({
    llm: model,
    tools: aniTools,
    prompt: aniDef.system_prompt,
    name: ANI_ID,
  });

  // Worker Agents：各自配置的 tools，排除 avatar category
  const workerAgents = workerDefs.map((def) => {
    const agentTools = def.tools
      .map((name) => toolLookup(name))
      .filter((t): t is DynamicStructuredTool => t !== undefined);

    let agentModel: ChatOpenAI;
    if (def.model_name && modelFactory) {
      agentModel = modelFactory(def.model_name);
    } else {
      agentModel = model;
    }

    if (def.temperature !== undefined && def.temperature !== null) {
      agentModel = new ChatOpenAI({
        modelName: (agentModel as any).modelName || (agentModel as any).lc_kwargs?.modelName,
        openAIApiKey: (agentModel as any).lc_kwargs?.openAIApiKey,
        configuration: (agentModel as any).lc_kwargs?.configuration,
        streaming: true,
        temperature: def.temperature,
      });
    }

    const agentIdHint = `\n\n[Agent 身份] 你的 Agent ID 是 "${def.id}"。调用 extract_memory 或 knowledge_query 工具时，请传入 agent_id="${def.id}" 以确保记忆隔离。`;

    return createReactAgent({
      llm: agentModel,
      tools: agentTools,
      prompt: def.system_prompt + agentIdHint,
      name: def.id,
    });
  });

  // Worker 能力描述，供 Ani 路由决策
  const workerDescriptions = workerDefs
    .map((def) => `- ${def.name}（${def.id}）: ${def.capabilities || ''} | 可用工具: ${def.tools.join(', ') || '无'}`)
    .join('\n');

  const supervisorPrompt = workerDescriptions
    ? `${aniDef.system_prompt}\n\n## 可调度的助手\n${workerDescriptions}`
    : aniDef.system_prompt;

  const supervisor = createSupervisor({
    agents: [aniAgent, ...workerAgents] as any,
    llm: model,
    prompt: `你是一个智能任务协调器（Supervisor）。你的职责是分析用户请求，将其分配给最合适的专业 AI 助手。

## 关键约束
你只能通过 transfer_to_* 工具将任务转交给助手，你**没有**任何其他工具（如 cron_job、web_search 等）。永远不要尝试调用不属于你的工具。

## 可用助手
${workerDescriptions}

## 编排规则
1. 分析用户请求，判断需要哪个（些）助手
2. 调用对应助手的 transfer_to_* 工具转交任务
3. 助手返回结果后，决定是否需要继续调用其他助手或直接回复用户
4. 用户指定偏好助手时，该助手能力范围内的任务优先转给它

## 特殊路由规则
- 定时任务、提醒、闹钟 → transfer 给拥有 cron_job 工具的助手
- 记忆提取、知识查询 → transfer 给拥有相应工具的助手
- 联网搜索 → transfer 给拥有 web_search 工具的助手

## 示例
- "搜索 Python 最新版本，写安装脚本" → 先 transfer 给 web_search 助手，再 transfer 给编程助手
- "每天早上8点提醒我喝水" → transfer 给拥有 cron_job 的助手
- 简单闲聊 → transfer 给最合适的单个助手`,
    outputMode: 'full_history',
    addHandoffBackMessages: true,
    supervisorName: ANI_ID,
  });

  return supervisor.compile({ checkpointer });
}
```

关键变化：
- 新增 `ANI_ID` 常量导出
- `AgentDefinition` 新增可选 `is_system` 字段
- 函数签名新增 `allTools?: DynamicStructuredTool[]` 参数，用于给 Ani 注入全部 tools
- Ani 节点使用 `allTools`（全部已注册 tools，含 avatar）
- Worker 节点只获得各自配置的 tools
- `supervisorName` 从 `'supervisor'` 改为 `ANI_ID`（`'ani'`）

- [ ] **Step 2: Commit**

```bash
git add backend/src/modules/langgraph/graph/supervisor.builder.ts
git commit -m "refactor(langgraph): Ani as Supervisor node with full tools + avatar control"
```

---

### Task 3: 后端 — LangGraph Service 改造

**Files:**
- Modify: `backend/src/modules/langgraph/langgraph.service.ts`
- Modify: `backend/src/modules/chat/chat.service.ts`

- [ ] **Step 1: 更新 rebuildSupervisorGraph 传入 allTools**

在 `langgraph.service.ts` 的 `rebuildSupervisorGraph` 方法中：

1. 将 `allTools` 传给 `buildSupervisorGraph`
2. Ani 作为 `is_system` Agent 获得全部 tools hint

修改 `rebuildSupervisorGraph` 方法（约第 78-108 行）：

```typescript
async rebuildSupervisorGraph() {
  const agents = await this.agentService.findAll();
  if (agents.length < 2) {
    this.supervisorGraph = null;
    return;
  }

  const allTools = this.toolRegistry.getAll();

  const definitions: AgentDefinition[] = agents
    .filter((a) => !LangGraphService.HIDDEN_AGENTS.includes(a.id))
    .map((a) => {
      const hintTools = this.getHintTools(a);
      return {
        id: a.id,
        name: a.name,
        system_prompt: this.buildPromptWithToolHints(a.system_prompt, hintTools),
        capabilities: a.capabilities || a.description,
        tools: a.tools || [],
        model_name: a.model_name || undefined,
        temperature: a.temperature ?? undefined,
        enabled: a.enabled !== false,
        is_system: a.is_system,
      };
    });

  this.supervisorGraph = buildSupervisorGraph(
    this.model,
    definitions,
    (name) => this.toolRegistry.get(name),
    (modelName) => this.createModel(modelName),
    allTools,
  );
  this.graphVersion++;
}
```

- [ ] **Step 2: 简化 getGraph — 移除 fast-path 意图匹配**

修改 `getGraph` 方法（约第 239-264 行），移除 `isIntentMatchForAgent` 调用：

```typescript
private async getGraph(
  preferredAgent?: string,
): Promise<CompiledStateGraph<any, any, any>> {
  if (this.rebuildNeeded) {
    this.rebuildNeeded = false;
    await this.rebuildSupervisorGraph();
  }

  if (preferredAgent) {
    try {
      const agent = await this.agentService.findOne(preferredAgent);
      if (agent.standalone) {
        return this.buildStandaloneGraph(agent);
      }
      // 非 standalone 且非隐藏 Agent → 走 Supervisor 图（Ani 会根据偏好路由）
    } catch {
      // Agent 不存在，回退到默认逻辑
    }
  }

  return this.supervisorGraph || this.singleAgentGraph;
}
```

同时更新 `chat` 和 `chatStream` 中调用 `getGraph` 的地方，去掉 `messages` 参数：

在 `chat` 方法中（约第 356 行）：
```typescript
const graph = await this.getGraph(preferredAgent);
```

在 `chatStream` 方法中（约第 377 行）：
```typescript
const graph = await this.getGraph(preferredAgent);
```

- [ ] **Step 3: 更新 chatStream 中的 supervisor 名称检测**

在 `chatStream` 方法中，`agentName === 'supervisor'` 的判断需要改为 `agentName === 'ani'`（因为 supervisorName 已改为 ani）。但由于 `supervisorName` 是 Supervisor 节点的 name，stream 中的 agent 切换检测是通过 message.name 获取的。

需要在文件顶部或 class 中定义常量：
```typescript
private static readonly ANI_ID = 'ani';
```

然后将 `chatStream` 中所有 `agentName === 'supervisor'` 替换为 `agentName === LangGraphService.ANI_ID`：

1. 约第 434 行：`agentName !== 'supervisor'` → `agentName !== LangGraphService.ANI_ID`
2. 约第 451 行：`agentName !== 'supervisor'` → `agentName !== LangGraphService.ANI_ID`
3. 约第 463-467 行：`const isFromSupervisor = agentName === 'supervisor'` → `const isFromAni = agentName === LangGraphService.ANI_ID`
4. 约第 485 行：`const isFromSupervisor = agentName === 'supervisor'` → `const isFromAni = agentName === LangGraphService.ANI_ID`

**注意**：Ani (Supervisor) 的文本输出现在是有意义的（角色回复），不再是内部路由决策。需要修改约第 463-467 行的过滤逻辑：

```typescript
// Ani 的文本输出是面向用户的，不需要过滤
// 但 handoff 提示仍需过滤
if (content === 'Transferring back to supervisor' || content === 'Transferring to ani') {
  continue;
}
yield { type: 'text', content };
```

完整的 chatStream AI 消息处理逻辑修改后：

```typescript
if (aiMsg.content && typeof aiMsg.content === 'string') {
  const content = aiMsg.content;
  const isAni = agentName === LangGraphService.ANI_ID;
  // 过滤框架内部 handoff 提示
  if (content === 'Transferring back to supervisor' || content === 'Transferring to ani') {
    continue;
  }
  yield { type: 'text', content };
}

if (aiMsg.tool_call_chunks && aiMsg.tool_call_chunks.length > 0) {
  for (const chunk of aiMsg.tool_call_chunks) {
    const idx = chunk.index ?? 0;
    const tcId = chunk.id || indexToId.get(idx) || `tc_${idx}`;

    if (!toolCalls.has(tcId)) {
      const tcName = chunk.name || 'unknown';
      const isAni = agentName === LangGraphService.ANI_ID;
      // Ani 的 handoff 工具调用需要过滤（内部路由）
      if (isHandoffTool(tcName) || isAni) {
        // Ani 调用 avatar 工具时，也需要拦截
        if (isAni && !isHandoffTool(tcName)) {
          // Ani 的非 handoff 工具（包括 avatar）需要展示给用户
          toolCalls.set(tcId, {
            name: tcName,
            argsBuffer: '',
            inputEmitted: false,
            outputEmitted: false,
          });
          indexToId.set(idx, tcId);
          yield { type: 'tool_start', toolCallId: tcId, toolName: tcName };
        } else {
          // handoff 工具调用：静默处理
          toolCalls.set(tcId, {
            name: tcName,
            argsBuffer: '',
            inputEmitted: true,
            outputEmitted: true,
          });
          indexToId.set(idx, tcId);
          continue;
        }
      } else {
        toolCalls.set(tcId, {
          name: tcName,
          argsBuffer: '',
          inputEmitted: false,
          outputEmitted: false,
        });
        indexToId.set(idx, tcId);
        yield { type: 'tool_start', toolCallId: tcId, toolName: tcName };
      }
    }

    const tc = toolCalls.get(tcId)!;
    if (tc && (isHandoffTool(tc.name) || tc.inputEmitted)) continue;
    if (chunk.args) {
      tc.argsBuffer += chunk.args;
      yield { type: 'tool_delta', toolCallId: tcId, argsDelta: chunk.args };
    }
  }
}
```

**重要修正**：上面的逻辑过于复杂。回到简洁方案 — 由于 `createSupervisor` 框架的特性，Supervisor 节点（Ani）的 tool calls 实际上只有 handoff 工具（框架限制）。Avatar 工具虽然注册给了 Ani 节点，但在 Supervisor 模式下 Ani 只能使用 handoff 工具。

**需要重新考虑架构**：`createSupervisor` 创建的 Supervisor 节点**只能**使用 `transfer_to_*` 工具，无法使用其他工具。所以不能简单地让 Ani 同时作为 Supervisor 和有工具的 Agent。

**修正方案**：不用 `createSupervisor`，改为手动构建图，让 Ani 节点既能直接回答/使用工具，也能 transfer 给 Worker。或者，使用 Ani 作为一个 React Agent，Worker 作为其可调用的工具链。

**最终决定**：保持 `createSupervisor` 架构不变，但让 Ani 作为一个 Worker Agent 存在（拥有全部 tools），Supervisor 仍然是匿名的路由器，但默认总是把简单任务路由给 Ani。这样改动最小，且 Ani 能真正使用全部工具。

这个方案需要回退 Task 2 的部分设计。具体实现见 Step 4。

- [ ] **Step 4: 重新设计 — Ani 作为拥有全部 tools 的 Worker + 默认路由目标**

修改 `supervisor.builder.ts` 的 `buildSupervisorGraph`：

```typescript
import { MemorySaver } from '@langchain/langgraph';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { createSupervisor } from '@langchain/langgraph-supervisor';
import { ChatOpenAI } from '@langchain/openai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { CompiledStateGraph } from '@langchain/langgraph';

export interface AgentDefinition {
  id: string;
  name: string;
  system_prompt: string;
  capabilities: string;
  tools: string[];
  model_name?: string;
  temperature?: number;
  enabled: boolean;
  is_system?: boolean;
}

export const ANI_ID = 'ani';

/**
 * 构建以 Ani 为默认路由目标的 Supervisor 图
 *
 * 架构：supervisor → [Ani | worker_A | worker_B | ...] → supervisor → ... → END
 * - supervisor 是匿名路由器，默认路由给 Ani
 * - Ani 拥有全部 tools（含 avatar），可直接回答或使用工具
 * - Worker 拥有各自配置的 tools
 */
export function buildSupervisorGraph(
  model: ChatOpenAI,
  agentDefinitions: AgentDefinition[],
  toolLookup: (name: string) => DynamicStructuredTool | undefined,
  modelFactory?: (modelName: string) => ChatOpenAI,
  allTools?: DynamicStructuredTool[],
): CompiledStateGraph<any, any, any> {
  const checkpointer = new MemorySaver();

  const enabledAgents = agentDefinitions.filter((d) => d.enabled);
  if (enabledAgents.length === 0) {
    throw new Error('No enabled agents available for supervisor');
  }

  const workerAgents = enabledAgents.map((def) => {
    const isAni = def.id === ANI_ID;
    // Ani 使用全部已注册 tools（含 avatar），Worker 使用各自配置的 tools
    const agentTools = isAni
      ? (allTools || [])
      : def.tools
          .map((name) => toolLookup(name))
          .filter((t): t is DynamicStructuredTool => t !== undefined);

    let agentModel: ChatOpenAI;
    if (def.model_name && modelFactory) {
      agentModel = modelFactory(def.model_name);
    } else {
      agentModel = model;
    }

    if (def.temperature !== undefined && def.temperature !== null) {
      agentModel = new ChatOpenAI({
        modelName: (agentModel as any).modelName || (agentModel as any).lc_kwargs?.modelName,
        openAIApiKey: (agentModel as any).lc_kwargs?.openAIApiKey,
        configuration: (agentModel as any).lc_kwargs?.configuration,
        streaming: true,
        temperature: def.temperature,
      });
    }

    const agentIdHint = isAni
      ? `\n\n[Agent 身份] 你是 Ani（Agent ID: "${def.id}"），作为默认助手直接处理用户的请求。调用 extract_memory 或 knowledge_query 工具时，请传入 agent_id="${def.id}"。`
      : `\n\n[Agent 身份] 你的 Agent ID 是 "${def.id}"。调用 extract_memory 或 knowledge_query 工具时，请传入 agent_id="${def.id}" 以确保记忆隔离。`;

    return createReactAgent({
      llm: agentModel,
      tools: agentTools,
      prompt: def.system_prompt + agentIdHint,
      name: def.id,
    });
  });

  // Agent 能力描述
  const agentDescriptions = enabledAgents
    .map((def) => {
      const tools = def.id === ANI_ID
        ? '全部工具（含 Avatar 表达控制）'
        : (def.tools.join(', ') || '无');
      return `- ${def.name}（${def.id}）: ${def.capabilities || ''} | 可用工具: ${tools}`;
    })
    .join('\n');

  const supervisor = createSupervisor({
    agents: workerAgents as any,
    llm: model,
    prompt: `你是一个智能任务协调器（Supervisor）。你的职责是分析用户请求，将其分配给最合适的专业 AI 助手。

## 关键约束
你只能通过 transfer_to_* 工具将任务转交给助手，你**没有**任何其他工具。永远不要尝试调用不属于你的工具。

## 可用助手
${agentDescriptions}

## 编排规则
1. 分析用户请求，判断需要哪个（些）助手
2. 简单问题（闲聊、查询、解释、定时任务等）直接 transfer 给 Ani
3. 需要专业处理的任务 transfer 给对应专家助手
4. 助手返回结果后，决定是否需要继续调用其他助手或直接回复用户
5. 用户指定偏好助手时，该助手能力范围内的任务优先转给它

## 特殊路由规则
- 定时任务、提醒、闹钟 → transfer 给 Ani（Ani 拥有 cron_job 工具）
- 记忆提取、知识查询 → transfer 给拥有相应工具的助手
- 联网搜索 → transfer 给 Ani（Ani 拥有 web_search 工具）
- 编程问题 → transfer 给编程专家
- 写作任务 → transfer 给写作助手`,
    outputMode: 'full_history',
    addHandoffBackMessages: true,
    supervisorName: 'supervisor',
  });

  return supervisor.compile({ checkpointer });
}
```

关键变化（相比原始代码）：
- 新增 `ANI_ID` 常量导出
- `AgentDefinition` 新增 `is_system` 字段
- 函数签名新增 `allTools` 参数
- Ani（`def.id === ANI_ID`）获得全部 `allTools`
- Worker 获得各自配置的 tools（avatar tools 自然不在 Worker 的 tools 列表中）
- Supervisor prompt 更新：默认路由给 Ani，Ani 拥有全部工具的描述
- `supervisorName` 保持 `'supervisor'`（不改，避免 stream 逻辑大幅改动）
- Agent ID hint 中 Ani 有特殊身份说明

- [ ] **Step 5: 更新 langgraph.service.ts 的 chatStream — 无需改动 supervisor 名称检测**

由于 `supervisorName` 保持 `'supervisor'`，`chatStream` 中所有 `agentName === 'supervisor'` 的判断**无需修改**。

但需要更新 avatar 工具拦截逻辑，确保只有 Ani 的 avatar 工具调用才触发事件（约第 568-575 行）：

当前代码：
```typescript
if (tc && (tc.name === 'express_emotion' || tc.name === 'play_motion')) {
```

由于只有 Ani 拥有 avatar tools，Worker 不会调用这些工具，所以当前拦截逻辑**无需修改**。

- [ ] **Step 6: 更新 chat.service.ts 的默认 Agent ID**

修改 `backend/src/modules/chat/chat.service.ts` 约第 269 行：

```typescript
const resolvedAgentId = agentId || 'ani';
```

- [ ] **Step 7: Commit**

```bash
git add backend/src/modules/langgraph/graph/supervisor.builder.ts backend/src/modules/langgraph/langgraph.service.ts backend/src/modules/chat/chat.service.ts
git commit -m "feat: Ani as default agent with full tools + avatar control in Supervisor graph"
```

---

### Task 4: 后端 — Worker Avatar Tools 排除

**Files:**
- Modify: `backend/src/modules/langgraph/langgraph.service.ts`（getHintTools 方法）

- [ ] **Step 1: 确保 Worker 的 getHintTools 不包含 avatar tools**

当前 `getHintTools` 方法（约第 208-210 行）：

```typescript
private getHintTools(agent: AgentEntity): string[] {
  return agent.is_system ? this.toolRegistry.getAllNames() : (agent.tools || []);
}
```

Ani 的 `is_system: true`，所以 `getHintTools` 返回全部 tools 名（包含 avatar）— 正确。

Worker 的 `is_system: false`，所以 `getHintTools` 返回各自配置的 tools — 正确（avatar tools 不在 Worker 的 tools 列表中）。

**无需修改**。逻辑已自然满足需求。

- [ ] **Step 2: Commit（无变更，跳过）**

---

### Task 5: 前端 — builtin-general → ani 全量替换

**Files:**
- Modify: `frontend/src/stores/chat.ts:70-72`
- Modify: `frontend/src/stores/agent.ts:14,81`
- Modify: `frontend/src/views/AgentConfigView.vue:484,492`

- [ ] **Step 1: 替换 stores/chat.ts**

`frontend/src/stores/chat.ts` 第 70-72 行：

```typescript
agentStore.setCurrentAgent(exists ? session.agent_id : "ani");
// ...
agentStore.setCurrentAgent("ani");
```

- [ ] **Step 2: 替换 stores/agent.ts**

`frontend/src/stores/agent.ts` 第 14 行和第 81 行：

```typescript
const currentAgentId = ref<string | null>("ani");
// ...
currentAgentId.value = "ani";
```

- [ ] **Step 3: 替换 AgentConfigView.vue**

`frontend/src/views/AgentConfigView.vue` 第 484 行：

```html
<span v-if="agent.id === 'ani'" class="role-badge supervisor-badge">Supervisor</span>
```

第 492 行：

```html
v-if="agent.id === 'ani' || agent.id === 'builtin-job-executor'"
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/stores/chat.ts frontend/src/stores/agent.ts frontend/src/views/AgentConfigView.vue
git commit -m "refactor(frontend): replace builtin-general references with ani"
```

---

### Task 6: 验证

- [ ] **Step 1: 后端 lint**

Run: `cd backend && pnpm lint`
Expected: 无错误

- [ ] **Step 2: 前端 lint**

Run: `cd frontend && pnpm lint`
Expected: 无错误

- [ ] **Step 3: 启动后端验证种子数据**

Run: `cd backend && pnpm dev`

预期日志中应看到 `ani` 相关初始化，不再有 `builtin-general`。

检查数据库 agents 表：
- `ani` 记录存在，`is_system: true`
- `builtin-general` 记录不存在（如果之前存在，`onModuleInit` 不会删除旧记录，需要手动处理或添加迁移逻辑）

- [ ] **Step 4: 处理数据库中已有的 builtin-general 记录**

在 `agent.service.ts` 的 `onModuleInit` 中，在种子数据同步循环后添加清理逻辑：

```typescript
// 清理已废弃的 builtin-general（如果存在）
const deprecatedIds = ['builtin-general'];
for (const id of deprecatedIds) {
  const exists = await this.agentRepo.existsBy({ id });
  if (exists) {
    await this.agentRepo.delete(id);
    console.log(`[AgentService] Removed deprecated agent: ${id}`);
  }
}

// 迁移已有 session 的 preferred_agent
// 这部分需要在 session repository 中处理
```

在 `chat.service.ts` 或 session 相关的服务中，将 `preferred_agent = 'builtin-general'` 的 session 更新为 `'ani'`。

修改 `agent.service.ts` 的 `onModuleInit`，在 for 循环后添加：

```typescript
// 清理已废弃的 Agent ID
const deprecatedIds = ['builtin-general'];
for (const depId of deprecatedIds) {
  const exists = await this.agentRepo.existsBy({ id: depId });
  if (exists) {
    await this.agentRepo.delete(depId);
  }
}
```

- [ ] **Step 5: 迁移 session 中的 preferred_agent**

在 `chat.service.ts` 中添加迁移方法或在 `onModuleInit` 中处理。最简单的方式是在 `buildSystemPrompt` 中做 fallback：

当前代码（第 269 行）：
```typescript
const resolvedAgentId = agentId || 'ani';
```

如果 `agentId` 从数据库读取为 `'builtin-general'`，`findOne('builtin-general')` 会抛 NotFoundException。需要在调用前做映射：

```typescript
const resolvedAgentId = (agentId === 'builtin-general' ? 'ani' : agentId) || 'ani';
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/agent/agent.service.ts backend/src/modules/chat/chat.service.ts
git commit -m "fix: cleanup deprecated builtin-general + migrate session preferred_agent"
```

- [ ] **Step 7: 端到端验证**

Run: `./dev.sh`

验证项：
1. Agent 配置页系统 tab 显示「Ani」和「定时任务执行器」
2. 新建会话默认使用 Ani
3. 发送简单问题，Ani 直接回答（通过 Supervisor 路由到 Ani）
4. 发送编程问题，Supervisor 路由到编程专家
5. Ani 可以调用 express_emotion 工具（观察 SSE 事件流）
6. Worker 不会调用 avatar 工具
