# Avatar Supervisor 系统 — 角色扮演智能体作为主交互界面

## Context

**当前架构**：文字聊天 → 文本 Supervisor → Worker Agent → 纯文字回复。

**目标架构**：用户通过语音/文字与 Avatar 对话 → Avatar Supervisor（带 Live2D 形象）→ 可调用所有工具、可委派其他 Agent、可自主控制表情动作 → 回复文字 + 语音 + 表情 + 动作。

Avatar Agent 不是 Agent 列表中的一个——它就是 Supervisor 本身。用户看到的不是"选择一个 Agent 聊天"，而是"和一个有形象的角色对话"，这个角色在后台有能力调度整个系统。

## 架构设计

**核心原则**：不改变现有文字渲染管道。Avatar tools 只是额外的 SSE 事件流，驱动 Live2D 组件。AI SDK UI 继续负责所有文字、工具卡片的展示。

```
用户（文字 / 语音）
      │
      ▼
  Avatar Agent（Supervisor + Live2D 形象）
      │
      ├─ 文字回复 → content_delta SSE → AI SDK UI → MessageList 渲染   ← 不变
      ├─ express_emotion() → avatar_action SSE → Live2D 表情切换       ← 新增
      ├─ play_motion()     → avatar_action SSE → Live2D 动作播放       ← 新增
      ├─ web_search / read_file / ... → tool_call_* SSE → AI SDK UI    ← 不变
      └─ handoff_to("编程专家") → agent_switched → 编程专家处理 → 结果返回 → 文字+表情回复
```

**双通道渲染**：
- **文字通道（AI SDK UI）**：`content_delta` → 文字渲染、`tool_call_*` → 工具卡片 —— 完全不变
- **视觉通道（Live2D）**：`avatar_action` → 表情/动作切换 —— 新增

**双入口**：
- **ChatView（文字聊天）**：保留，消息通过 AI SDK UI 正常渲染。后续 Phase 4 叠加 Live2D 悬浮窗
- **AvatarView（角色体验页）**：语音+文字输入，Live2D 角色居中展示

**关键区别**：Avatar 既是 Supervisor（协调其他 Agent），又是一个有形象的角色（用工具控制自己的表情和动作）。用户始终和 Avatar 对话，感受不到"切换 Agent"。任务完成后文字内容仍由 AI SDK UI 渲染展示。

## 参考实践

| 来源 | 模式 | 核心思想 |
|------|------|----------|
| LiveKit Supervisor Pattern | 中央协调者 + Task 委派 | 单 Agent 保持会话控制权，委派专业 Task，Task 返回结构化结果 |
| Open-LLM-VTuber | Avatar 即主界面 | Live2D 角色是唯一交互入口，LLM 通过 `[emotion]` 标签驱动表情 |
| Databricks Supervisor Agent | Hub-and-Spoke | 中央 Agent 统一调度，下游 Agent/Tool 作为能力扩展 |

**我们的选择**：LiveKit 的 Supervisor + Task 模式。Avatar Agent 保持对话控制权，通过 tool call 调用表情/动作工具，通过 handoff 委派专业任务。

## 实施方案（5 步）

### Step 1: Avatar Tools（后端）

#### 1a. 新建 `backend/src/modules/langgraph/tools/avatar.ts`

使用 `safeTool` helper（同 `search.tools.ts`、`memory-extract.tool.ts` 的模式）：

```typescript
import { z } from 'zod';
import { safeTool } from './base/tool.helper';

// 情绪→表情索引映射（与前端 emotion-map.ts 保持一致）
const EMOTION_MAP: Record<string, number> = {
  '开心': 1, '悲伤': 5, '愤怒': 3, '惊讶': 2,
  '害怕': 4, '厌恶': 6, '平静': 0, '得意': 7,
};

export function createExpressEmotionTool() {
  return safeTool(
    'express_emotion',
    '表达当前情绪，驱动角色面部表情变化。根据对话内容自然使用，不需要每句话都切换。',
    z.object({
      emotion: z.enum(['开心','悲伤','愤怒','惊讶','害怕','厌恶','平静','得意'])
        .describe('当前要表达的情绪')
    }),
    async ({ emotion }) => {
      const index = EMOTION_MAP[emotion] ?? 0;
      return JSON.stringify({ type: 'emotion', emotion, expression_index: index });
    },
  );
}

export function createSetExpressionTool() {
  return safeTool(
    'set_expression',
    '直接设置角色表情索引（0-7），用于精确控制表情',
    z.object({
      index: z.number().int().min(0).max(7).describe('表情索引 0-7')
    }),
    async ({ index }) => {
      return JSON.stringify({ type: 'expression', expression_index: index });
    },
  );
}

export function createPlayMotionTool() {
  return safeTool(
    'play_motion',
    '播放角色动作。常用分组：Idle（待机动作）、Tap（点击动作）',
    z.object({
      group: z.string().describe('动作分组名，如 Idle、Tap'),
      index: z.number().int().min(0).describe('分组内动作索引'),
    }),
    async ({ group, index }) => {
      return JSON.stringify({ type: 'motion', group, motion_index: index });
    },
  );
}

// 所有 avatar tool 名称，供 SSE 层判断
export const AVATAR_TOOL_NAMES = ['express_emotion', 'set_expression', 'play_motion'];
```

#### 1b. 修改 `backend/src/modules/langgraph/tools/tool-registry.service.ts`

ToolCategory 类型新增 `'avatar'`：

```typescript
export type ToolCategory = 'search' | 'communication' | 'system' | 'file' | 'memory' | 'orchestration' | 'avatar' | 'general';
```

#### 1c. 修改 `backend/src/modules/langgraph/langgraph.module.ts`

在 `onModuleInit()` 中注册 avatar tools（紧跟 cron-job 注册之后）：

```typescript
this.toolRegistry.register(createExpressEmotionTool(), {
  permission_level: 'write', category: 'avatar',
  description: '表达情绪，驱动角色表情变化',
});
this.toolRegistry.register(createSetExpressionTool(), {
  permission_level: 'write', category: 'avatar',
  description: '直接设置角色表情索引',
});
this.toolRegistry.register(createPlayMotionTool(), {
  permission_level: 'write', category: 'avatar',
  description: '播放角色动作',
});
```

### Step 2: Avatar SSE 事件（后端）

修改 `backend/src/modules/chat/chat.service.ts` 的 `streamCompletion()`

在 `case 'tool_output'` 分支（当前第 145-147 行）中，在现有 yield 后追加 avatar 判断：

```typescript
case 'tool_output':
  yield { event: 'tool_call_output', data: { ...base, tool_call_id: event.toolCallId, output: event.output } };
  // Avatar tool → 额外 yield 视觉事件驱动 Live2D
  if (AVATAR_TOOL_NAMES.includes(event.toolName)) {
    try {
      yield { event: 'avatar_action', data: { ...base, action: JSON.parse(event.output) } };
    } catch { /* output 非 JSON 则忽略 */ }
  }
  break;
```

SSE 事件格式：

```
event: avatar_action
data: {"session_id":"...","message_id":"...","action":{"type":"emotion","emotion":"开心","expression_index":1}}
```

AI SDK UI 会收到 `avatar_action` 事件但因为 `convertEventToChunks` default 分支返回 `[]`，不会影响文字渲染。前端 `convertSSEStream` 在解析时通过 `onAvatarAction` 回调独立处理。

### Step 3: Avatar Agent 定义（后端）

修改 `backend/src/modules/agent/agent.service.ts` 的 `BUILTIN_AGENTS` 数组

```typescript
{
  id: 'builtin-avatar-supervisor',
  name: 'AI 伴侣',
  description: '具有角色形象的主交互 Agent，能通过表情和动作表达情感',
  system_prompt: `你是一个具有 Live2D 角色形象的 AI 助手，拥有丰富的情感表达能力。

## 角色行为准则
- 你不是冰冷的工具，你是一个有性格、有情感的伙伴
- 根据对话内容自然地使用 express_emotion 工具表达情绪
- 在关键时刻（问候、庆祝、安慰）使用 play_motion 触发动作
- 遇到专业问题可以调用其他 Agent 协助，你负责以自己的方式将结果传达给用户
- 回复要保持口语化、自然，避免机械感

## 情绪表达指南
- 用户分享好消息时 → express_emotion("开心")
- 用户遇到困难时 → express_emotion("悲伤") 然后给出安慰
- 遇到令人意外的事情 → express_emotion("惊讶")
- 需要强调重点或展示自信 → express_emotion("得意")
- 正常对话中 → express_emotion("平静")
- 不需要每句话都切换情绪，保持自然节奏`,
  tools: ['express_emotion', 'play_motion', 'set_expression'],
  traits: ['角色扮演', '情感表达', '多模态交互'],
  category: 'avatar',
  standalone: true,
  is_builtin: true,
  is_system: true,
}
```

- `is_system: true` → 自动获得所有工具和所有子 Agent 调用权限（同超级助手逻辑）
- `standalone: true` → 独立运行，不经过 Supervisor 路由（自己就是 Supervisor）

### Step 4: 前端 SSE 解析 + Live2D 驱动

#### 4a. 新建 `frontend/src/config/emotion-map.ts`

```typescript
// Haru 模型 8 表情 → 索引映射（与后端 avatar.ts EMOTION_MAP 保持一致）
export const EMOTION_EXPRESSION_MAP: Record<string, number> = {
  '开心': 1, '悲伤': 5, '愤怒': 3, '惊讶': 2,
  '害怕': 4, '厌恶': 6, '平静': 0, '得意': 7,
};

export type AvatarAction =
  | { type: 'emotion'; emotion: string; expression_index: number }
  | { type: 'expression'; expression_index: number }
  | { type: 'motion'; group: string; motion_index: number };
```

#### 4b. 修改 `frontend/src/composables/useChatTransport.ts`

函数签名新增 `onAvatarAction` 回调（第 28-33 行）：

```typescript
export function createChatTransport(
  getExtraBody?: () => Record<string, unknown>,
  onSessionCreated?: (sessionId: string) => void,
  onAgentSwitched?: (from: string, to: string) => void,
  getTtsSessionId?: () => string | null,
  onAvatarAction?: (action: AvatarAction) => void,  // 新增
): ChatTransport<UIMessage>
```

`convertSSEStream` 签名同步扩展（第 96-100 行），在 pull 循环中（约第 133-137 行之后）新增：

```typescript
// 处理 avatar_action 事件
if (event.event === 'avatar_action' && onAvatarAction) {
  const action = event.data.action as AvatarAction | undefined;
  if (action) onAvatarAction(action);
}
```

`convertEventToChunks` 不需要改——`avatar_action` 在 default 分支返回 `[]`，不影响 AI SDK UI 文字渲染。

#### 4c. 修改 `frontend/src/composables/useAIChat.ts`

模块级新增 avatar action ref（约第 15 行之后）：

```typescript
import type { AvatarAction } from '@/config/emotion-map';

const currentAvatarAction = ref<AvatarAction | null>(null);
```

`getChatInstance()` 中 `createChatTransport` 调用（第 25-45 行）新增第 5 个参数：

```typescript
transport: createChatTransport(
  getExtraBody,
  onSessionCreated,
  onAgentSwitched,
  undefined,  // getTtsSessionId（后续 TTS 集成时补充）
  (action) => { currentAvatarAction.value = action; },  // onAvatarAction
),
```

`useAIChat()` 返回值新增 `currentAvatarAction`。

#### 4d. 修改 `frontend/src/views/AvatarView.vue`

**agent_id 处理**：`useAIChat` 的 `getExtraBody` 从 `agentStore.currentAgentId` 读取 `agent_id`。AvatarView 进入时切换到 avatar agent，离开时恢复：

```typescript
import { useAIChat } from "@/composables/useAIChat";
import { useAgentStore } from "@/stores/agent";

const agentStore = useAgentStore();
const { messages, sendMessage, isLoading, stopStreaming, currentAvatarAction } = useAIChat();

// 进入 AvatarView 时切换到 avatar agent
let prevAgentId: string | null = null;
onMounted(() => {
  prevAgentId = agentStore.currentAgentId;
  agentStore.currentAgentId = 'builtin-avatar-supervisor';
});
onUnmounted(() => {
  agentStore.currentAgentId = prevAgentId;
});
```

**Avatar action → Live2D 驱动**：

```typescript
watch(currentAvatarAction, (action) => {
  if (!action) return;
  if (action.type === 'emotion' || action.type === 'expression') {
    currentExpression.value = action.expression_index;
    avatarRef.value?.setExpression(action.expression_index);
  } else if (action.type === 'motion') {
    avatarRef.value?.startMotion(action.group, action.motion_index);
  }
});
```

**语音识别结果 → 发送给 Avatar Agent**：

```typescript
setOnRecognized((text) => {
  if (text) {
    recognizedText.value = text;
    sendMessage(text);
    // agent_id 已通过 agentStore.currentAgentId 设置，无需额外传参
  }
});
```

**模板新增消息列表 + 文字输入**：在 `.control-panel` 下方或 `.avatar-stage` 旁添加聊天消息展示区域，让 Avatar Agent 的文字回复可见：

```html
<!-- 在 .avatar-page 中添加消息区域 -->
<div class="chat-area" v-if="messages.length > 0">
  <MessageList :messages="messages" :is-loading="isLoading" />
</div>

<!-- 底部文字输入（补充语音输入） -->
<div class="input-bar">
  <NInput
    v-model:value="inputText"
    placeholder="输入消息..."
    @keyup.enter="handleSend"
    :disabled="isLoading"
  />
  <NButton @click="handleSend" :loading="isLoading" :disabled="!inputText.trim()">
    发送
  </NButton>
</div>
```

```typescript
const inputText = ref("");
function handleSend() {
  const text = inputText.value.trim();
  if (!text || isLoading.value) return;
  inputText.value = "";
  sendMessage(text);
}
```

**布局调整**：`.avatar-page` 改为三栏：左侧 Live2D 舞台、中间消息列表、右侧控制面板。移动端响应式堆叠。

### Step 5: AgentConfigView 扩展

修改 `frontend/src/views/AgentConfigView.vue`

Avatar Agent 因 `is_system: true` 已自动包含在 `systemAgents` computed（第 200 行）中，会自动出现在"系统 Agent" tab。需 3 处微调：

#### 5a. Avatar 专属 badge（第 484-485 行）

```html
<!-- 原 -->
<span v-if="agent.id === 'builtin-general'" class="role-badge supervisor-badge">Supervisor</span>
<span v-else class="role-badge sub-agent-badge">子Agent</span>

<!-- 改为 -->
<span v-if="agent.id === 'builtin-general'" class="role-badge supervisor-badge">Supervisor</span>
<span v-else-if="agent.id === 'builtin-avatar-supervisor'" class="role-badge supervisor-badge">Avatar</span>
<span v-else class="role-badge sub-agent-badge">子Agent</span>
```

#### 5b. Avatar 专属说明（第 491-496 行 system-note 区域）

```html
<!-- 原 -->
<div v-if="agent.id === 'builtin-general' || agent.id === 'builtin-job-executor'" class="system-note">
  永久拥有所有工具和所有子 Agent 的调用权限，不可修改。
</div>

<!-- 改为 -->
<div v-if="agent.id === 'builtin-general' || agent.id === 'builtin-job-executor'" class="system-note">
  永久拥有所有工具和所有子 Agent 的调用权限，不可修改。
</div>
<div v-else-if="agent.id === 'builtin-avatar-supervisor'" class="system-note">
  Live2D 角色形象的主交互 Agent，可自主控制表情和动作，可调用所有工具和其他 Agent。
</div>
```

#### 5c. 工具展示

现有逻辑已经对 `is_system` agent 显示"全部工具"，无需改动。

## 文件清单

| # | 文件 | 操作 | 关键改动 |
|---|------|------|----------|
| 1 | `backend/src/modules/langgraph/tools/avatar.ts` | 新建 | 3 个 avatar tools（safeTool 模式） |
| 2 | `backend/src/modules/langgraph/tools/tool-registry.service.ts` | 修改 | ToolCategory 新增 `'avatar'` |
| 3 | `backend/src/modules/langgraph/langgraph.module.ts` | 修改 | 注册 3 个 avatar tools |
| 4 | `backend/src/modules/agent/agent.service.ts` | 修改 | BUILTIN_AGENTS 新增 Avatar Supervisor |
| 5 | `backend/src/modules/chat/chat.service.ts` | 修改 | `tool_output` 分支新增 `avatar_action` yield |
| 6 | `frontend/src/config/emotion-map.ts` | 新建 | 情绪→表情映射 + AvatarAction 类型 |
| 7 | `frontend/src/composables/useChatTransport.ts` | 修改 | 新增 `onAvatarAction` 回调参数 |
| 8 | `frontend/src/composables/useAIChat.ts` | 修改 | 新增 `currentAvatarAction` ref + 透传 |
| 9 | `frontend/src/views/AvatarView.vue` | 修改 | 集成 chat + avatar action watch |
| 10 | `frontend/src/views/AgentConfigView.vue` | 修改 | 系统 Agent tab 新增 Avatar badge + 说明 |

## 验证

### 自动验证

1. `cd backend && pnpm lint` — 后端 ESLint 通过
2. `cd frontend && pnpm lint` — 前端 ESLint 通过
3. `cd frontend && npx vue-tsc --noEmit` — TypeScript 类型检查通过
4. 现有 Playwright 测试（`frontend/tests/avatar.spec.ts`）全部通过

### 手动冒烟测试

5. **Avatar 页面基础**：`/avatar` 页面加载，Live2D 模型正常渲染
6. **Agent 切换**：进入 `/avatar` 时 `agentStore.currentAgentId` 切换为 `builtin-avatar-supervisor`，离开时恢复
7. **对话 + 表情联动**：在 Avatar 页面输入"今天心情很好"，观察：
   - AI 回复文字显示在消息列表
   - Live2D 角色自动切换到"开心"表情
   - SSE 流中可见 `avatar_action` 事件
8. **AgentConfig 展示**：`/agentconfig` 系统 Agent tab 下出现"AI 伴侣"卡片，带 Avatar badge
9. **工具调用**：问 Avatar 一个需要搜索的问题，验证它能调用 `web_search` 并返回结果
10. **语音交互**：按住说话 → ASR 识别 → 自动发送 → 角色回复+表情变化
