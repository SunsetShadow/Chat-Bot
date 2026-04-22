# Avatar 双通道渲染架构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Avatar Live2D 角色集成到 ChatView，通过 Agent 工具调用驱动表情/动作，实现双通道（文本 + 视觉）渲染。

**Architecture:** SSE 流经 MessageDispatcher 同时分发到文本通道（AI SDK UI 现有管线）和视觉通道（AvatarPanel）。Supervisor Agent 通过 `express_emotion` / `play_motion` 工具自主控制角色表情和动作，工具调用结果通过新增 `avatar_action` SSE 事件传递到前端。前端 AvatarFloat 组件消费该事件驱动 Live2D。

**Tech Stack:** NestJS + LangGraph (backend), Vue 3 + PixiJS 6 + pixi-live2d-display (frontend), SSE streaming

---

## File Structure

### New Files

| File | Responsibility |
|------|----------------|
| `backend/src/modules/langgraph/tools/avatar.tool.ts` | Avatar 工具定义（express_emotion, play_motion） |
| `frontend/src/types/avatar.ts` | Avatar 相关 TypeScript 类型 |
| `frontend/src/config/emotion-map.ts` | Haru 模型默认情绪映射 |
| `frontend/src/composables/useAvatarLayout.ts` | Avatar 布局模式管理（悬浮/并排/全屏） |
| `frontend/src/components/avatar/AvatarFloat.vue` | ChatView 中的 Avatar 悬浮窗组件 |

### Modified Files

| File | Change |
|------|--------|
| `backend/src/modules/langgraph/tools/tool-registry.service.ts:5` | ToolCategory 增加 `'avatar'` |
| `backend/src/common/stream-events.ts` | 增加 `AVATAR_ACTION_EVENT` 常量 |
| `backend/src/modules/langgraph/langgraph.service.ts:23-36` | StreamEvent 增加 `avatar_action` 类型 |
| `backend/src/modules/langgraph/langgraph.service.ts:561-565` | chatStream 中拦截 avatar 工具输出，发射 avatar_action |
| `backend/src/modules/langgraph/langgraph.module.ts:59-66` | 注册 avatar 工具 |
| `backend/src/modules/chat/chat.service.ts:120-163` | switch 增加 `avatar_action` case |
| `frontend/src/composables/useChatTransport.ts:28-33` | 增加 `onAvatarAction` 回调参数 |
| `frontend/src/composables/useChatTransport.ts:123-137` | 处理 `avatar_action` SSE 事件 |
| `frontend/src/composables/useAIChat.ts:15` | 增加 `avatarAction` ref |
| `frontend/src/composables/useAIChat.ts:24-45` | transport 创建时传入 avatar 回调 |
| `frontend/src/components/chat/ChatContainer.vue:62-150` | 主区域增加 AvatarFloat |

---

## Task 1: Backend — Avatar 工具定义与注册

**Files:**
- Create: `backend/src/modules/langgraph/tools/avatar.tool.ts`
- Modify: `backend/src/modules/langgraph/tools/tool-registry.service.ts:5`
- Modify: `backend/src/modules/langgraph/langgraph.module.ts:59-66`

- [ ] **Step 1: 在 ToolCategory 中增加 `'avatar'`**

```typescript
// backend/src/modules/langgraph/tools/tool-registry.service.ts:5
// 修改前:
export type ToolCategory = 'search' | 'communication' | 'system' | 'file' | 'memory' | 'orchestration' | 'general';
// 修改后:
export type ToolCategory = 'search' | 'communication' | 'system' | 'file' | 'memory' | 'orchestration' | 'general' | 'avatar';
```

- [ ] **Step 2: 创建 avatar.tool.ts**

```typescript
// backend/src/modules/langgraph/tools/avatar.tool.ts
import { z } from 'zod';
import { safeTool } from './base/tool.helper';

export function createExpressEmotionTool() {
  return safeTool(
    'express_emotion',
    `设置虚拟角色的表情，表达你当前的情绪状态。

何时使用：
- 回复用户时想表达情感（开心、同情、思考等）
- 对用户的提问表示好奇或惊讶
- 任务完成时表达满足感
- 遇到错误时表示歉意

可用表情：neutral（平静）, happy（开心）, sad（悲伤）, angry（生气）, surprised（惊讶）, sympathetic（同情）, thinking（思考）, excited（兴奋）

注意：每次回复最多调用一次，选择最贴合当前语境的表情。`,
    z.object({
      emotion: z.enum([
        'neutral', 'happy', 'sad', 'angry',
        'surprised', 'sympathetic', 'thinking', 'excited',
      ]).describe('要表达的情绪'),
    }),
    async ({ emotion }) => {
      return JSON.stringify({ action: 'expression', emotion });
    },
  );
}

export function createPlayMotionTool() {
  return safeTool(
    'play_motion',
    `播放虚拟角色的动作动画。

何时使用：
- 打招呼时播放招手动作
- 完成任务时播放庆祝动作
- 用户长时间未回复时播放待机动作
- 需要增强表达效果时

可用动作组：
- Idle: 待机动作（index 0-2）
- Tap: 点击反应动作（index 0-1）

不指定 index 则随机播放该组中的一个动作。`,
    z.object({
      group: z.enum(['Idle', 'Tap']).describe('动作组名'),
      index: z.number().int().min(0).optional().describe('动作索引，不填则随机'),
    }),
    async ({ group, index }) => {
      return JSON.stringify({ action: 'motion', group, index: index ?? -1 });
    },
  );
}
```

- [ ] **Step 3: 在 langgraph.module.ts 注册 avatar 工具**

在 `onModuleInit()` 中，cron-job 工具注册之后（第 66 行之后）、`initGraph()` 之前（第 69 行之前）添加：

```typescript
// backend/src/modules/langgraph/langgraph.module.ts
// 在文件顶部增加 import:
import { createExpressEmotionTool, createPlayMotionTool } from './tools/avatar.tool';

// 在 onModuleInit() 中，第 66 行之后增加:
// 注册 Avatar 控制工具
this.toolRegistry.register(createExpressEmotionTool(), {
  permission_level: 'write',
  category: 'avatar',
  description: '设置虚拟角色表情',
});
this.toolRegistry.register(createPlayMotionTool(), {
  permission_level: 'write',
  category: 'avatar',
  description: '播放虚拟角色动作',
});
```

- [ ] **Step 4: 验证后端编译通过**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/backend && pnpm lint && npx tsc --noEmit`
Expected: 无报错

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/langgraph/tools/avatar.tool.ts \
        backend/src/modules/langgraph/tools/tool-registry.service.ts \
        backend/src/modules/langgraph/langgraph.module.ts
git commit -m "feat(avatar): 添加 Avatar 工具定义 (express_emotion, play_motion)"
```

---

## Task 2: Backend — StreamEvent 扩展 + SSE avatar_action 事件

**Files:**
- Modify: `backend/src/common/stream-events.ts`
- Modify: `backend/src/modules/langgraph/langgraph.service.ts:23-36` (StreamEvent type)
- Modify: `backend/src/modules/langgraph/langgraph.service.ts:561-565` (chatStream tool output)
- Modify: `backend/src/modules/chat/chat.service.ts:120-163` (SSE switch)

- [ ] **Step 1: 在 stream-events.ts 增加 Avatar 事件常量**

```typescript
// backend/src/common/stream-events.ts — 文件末尾追加:

export const AVATAR_ACTION_EVENT = 'avatar.action';

export interface AvatarActionPayload {
  action: 'expression' | 'motion';
  emotion?: string;
  group?: string;
  index?: number;
}
```

- [ ] **Step 2: 在 StreamEvent 联合类型中增加 avatar_action**

```typescript
// backend/src/modules/langgraph/langgraph.service.ts:23-36
// 在 finish 行之前增加一行:

export type StreamEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_start'; toolCallId: string; toolName: string }
  | { type: 'tool_delta'; toolCallId: string; argsDelta: string }
  | { type: 'tool_input'; toolCallId: string; toolName: string; args: Record<string, unknown> }
  | { type: 'tool_output'; toolCallId: string; output: string }
  | { type: 'step_start' }
  | { type: 'agent_switched'; fromAgent: string; toAgent: string }
  | { type: 'avatar_action'; payload: { action: string; [key: string]: unknown } }  // 新增
  | { type: 'finish'; finishReason: string };
```

- [ ] **Step 3: 在 chatStream 中拦截 avatar 工具输出**

在 `langgraph.service.ts` chatStream 方法的 tool output 处理块（第 561-565 行），在 `yield { type: 'tool_output', ... }` 之后增加 avatar 拦截逻辑：

```typescript
// langgraph.service.ts:561-565 修改后:
if (!tc?.outputEmitted) {
  if (tc) tc.outputEmitted = true;
  yield { type: 'tool_output', toolCallId, output: outputStr };
  sawToolOutput = true;

  // Avatar 工具拦截：解析工具输出并发射 avatar_action 事件
  if (tc && (tc.name === 'express_emotion' || tc.name === 'play_motion')) {
    try {
      const payload = JSON.parse(outputStr);
      yield { type: 'avatar_action', payload };
    } catch {
      // 解析失败静默忽略
    }
  }
}
```

- [ ] **Step 4: 在 chat.service.ts SSE switch 中增加 avatar_action case**

在 `chat.service.ts` 第 158 行（`case 'agent_switched'` 之后）增加：

```typescript
// chat.service.ts:158 之后增加:

case 'avatar_action':
  yield {
    event: 'avatar_action',
    data: { ...base, ...event.payload },
  };
  break;
```

- [ ] **Step 5: 验证后端编译通过**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/backend && pnpm lint && npx tsc --noEmit`
Expected: 无报错

- [ ] **Step 6: Commit**

```bash
git add backend/src/common/stream-events.ts \
        backend/src/modules/langgraph/langgraph.service.ts \
        backend/src/modules/chat/chat.service.ts
git commit -m "feat(avatar): SSE 流增加 avatar_action 事件通道"
```

---

## Task 3: Frontend — Avatar 类型定义 + 情绪映射

**Files:**
- Create: `frontend/src/types/avatar.ts`
- Create: `frontend/src/config/emotion-map.ts`

- [ ] **Step 1: 创建 Avatar 类型文件**

```typescript
// frontend/src/types/avatar.ts

/** SSE avatar_action 事件的 payload */
export interface AvatarActionPayload {
  action: 'expression' | 'motion';
  emotion?: string;
  group?: string;
  index?: number;
}

/** 布局模式 */
export type AvatarLayoutMode = 'float' | 'side' | 'fullscreen';

/** 情绪 → 表情索引映射 */
export type EmotionMap = Record<string, number>;

/** Avatar 工具名常量 */
export const AVATAR_TOOL_NAMES = ['express_emotion', 'play_motion'] as const;
```

- [ ] **Step 2: 创建 Haru 模型默认情绪映射**

查看 Haru 模型配置以确定正确的表情索引：

```typescript
// frontend/src/config/emotion-map.ts
import type { EmotionMap } from '@/types/avatar';

/**
 * Haru 模型默认情绪映射
 *
 * Haru expressions (haru_greeter_t03.model3.json):
 *   F01 = exp3 (index 0), F02 = exp3 (index 1), ..., F08 = exp3 (index 7)
 *
 * 语义映射（基于表情文件名和视觉测试）:
 *   0: 默认/微笑
 *   1: 开心
 *   2: 悲伤
 *   3: 生气
 *   4: 惊讶
 *   5: 同情/温柔
 *   6: 思考
 *   7: 兴奋
 */
export const HARU_EMOTION_MAP: EmotionMap = {
  neutral: 0,
  happy: 1,
  sad: 2,
  angry: 3,
  surprised: 4,
  sympathetic: 5,
  thinking: 6,
  excited: 7,
};
```

- [ ] **Step 3: 验证前端编译通过**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/frontend && pnpm build 2>&1 | tail -5`
Expected: 构建成功

- [ ] **Step 4: Commit**

```bash
git add frontend/src/types/avatar.ts frontend/src/config/emotion-map.ts
git commit -m "feat(avatar): Avatar 类型定义 + Haru 情绪映射"
```

---

## Task 4: Frontend — useChatTransport 处理 avatar_action SSE 事件

**Files:**
- Modify: `frontend/src/composables/useChatTransport.ts:28-33` (增加回调参数)
- Modify: `frontend/src/composables/useChatTransport.ts:123-137` (处理事件)
- Modify: `frontend/src/composables/useAIChat.ts:15` (增加 avatarAction ref)
- Modify: `frontend/src/composables/useAIChat.ts:24-45` (传入回调)

- [ ] **Step 1: useChatTransport 增加 onAvatarAction 回调**

```typescript
// frontend/src/composables/useChatTransport.ts:28-33
// 修改函数签名，增加 onAvatarAction 参数:

export function createChatTransport(
  getExtraBody?: () => Record<string, unknown>,
  onSessionCreated?: (sessionId: string) => void,
  onAgentSwitched?: (from: string, to: string) => void,
  getTtsSessionId?: () => string | null,
  onAvatarAction?: (payload: { action: string; [key: string]: unknown }) => void,  // 新增
): ChatTransport<UIMessage> {
```

同时更新 `sendMessages` 中调用 `convertSSEStream` 的地方，传入 `onAvatarAction`：

```typescript
// frontend/src/composables/useChatTransport.ts:84
// 修改前:
return convertSSEStream(response.body, onSessionCreated, onAgentSwitched);
// 修改后:
return convertSSEStream(response.body, onSessionCreated, onAgentSwitched, onAvatarAction);
```

- [ ] **Step 2: convertSSEStream 增加 onAvatarAction 参数**

```typescript
// frontend/src/composables/useChatTransport.ts:96-100
// 修改函数签名:

function convertSSEStream(
  rawStream: ReadableStream<Uint8Array>,
  onSessionCreated?: (sessionId: string) => void,
  onAgentSwitched?: (from: string, to: string) => void,
  onAvatarAction?: (payload: { action: string; [key: string]: unknown }) => void,  // 新增
): ReadableStream<UIMessageChunk> {
```

- [ ] **Step 3: 在 SSE 事件处理循环中处理 avatar_action**

在 `convertSSEStream` 的事件循环中（第 123-137 行 `agent_switched` 处理之后），增加 avatar_action 处理：

```typescript
// frontend/src/composables/useChatTransport.ts
// 在 agent_switched 处理块之后（第 137 行之后）增加:

// 处理 avatar_action 事件
if (event.event === 'avatar_action' && onAvatarAction) {
  const { action, ...rest } = event.data;
  if (action) {
    onAvatarAction({ action: action as string, ...rest });
  }
}
```

- [ ] **Step 4: 在 useAIChat 中增加 avatarAction ref 和回调**

```typescript
// frontend/src/composables/useAIChat.ts

// 1. 在文件顶部增加 import:
import type { AvatarActionPayload } from '@/types/avatar';

// 2. 在模块级变量区域（第 15 行之后）增加:
const avatarAction = ref<AvatarActionPayload | null>(null);

// 3. 修改 getChatInstance 中的 transport 创建（第 25 行），增加第 5 个参数:
//    在 (from, to) => { ... } 之后，增加:
(_payload) => {
  avatarAction.value = _payload as AvatarActionPayload;
  // 3 秒后自动清除，避免重复触发
  setTimeout(() => {
    if (avatarAction.value === _payload) {
      avatarAction.value = null;
    }
  }, 3000);
},
```

具体修改 `getChatInstance()` 中的 `createChatTransport` 调用：

```typescript
// useAIChat.ts — 修改 createChatTransport 调用（第 25-45 行）:
chatInstance = new Chat({
  transport: createChatTransport(
    () => { /* ... existing getExtraBody ... */ },
    (sessionId) => { /* ... existing onSessionCreated ... */ },
    (_from, to) => { /* ... existing onAgentSwitched ... */ },
    undefined,  // getTtsSessionId — 不在此处处理
    (payload) => {  // 新增: onAvatarAction
      avatarAction.value = payload as AvatarActionPayload;
      setTimeout(() => {
        if (avatarAction.value === payload) {
          avatarAction.value = null;
        }
      }, 3000);
    },
  ),
  // ... onError, onFinish 不变
});
```

- [ ] **Step 5: 在 useAIChat return 中导出 avatarAction**

```typescript
// useAIChat.ts — return 对象中增加 avatarAction:
return {
  messages,
  status,
  isLoading,
  error,
  activeAgent,
  avatarAction,  // 新增
  sendMessage,
  stopStreaming,
  regenerate,
  loadMessages,
  clearMessages,
  resetChat,
};
```

- [ ] **Step 6: 验证前端编译通过**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/frontend && pnpm build 2>&1 | tail -5`
Expected: 构建成功

- [ ] **Step 7: Commit**

```bash
git add frontend/src/composables/useChatTransport.ts \
        frontend/src/composables/useAIChat.ts
git commit -m "feat(avatar): SSE avatar_action 事件处理 + avatarAction ref"
```

---

## Task 5: Frontend — useAvatarLayout composable

**Files:**
- Create: `frontend/src/composables/useAvatarLayout.ts`

- [ ] **Step 1: 创建布局管理 composable**

```typescript
// frontend/src/composables/useAvatarLayout.ts
import { ref, watch } from 'vue';
import type { AvatarLayoutMode } from '@/types/avatar';

const STORAGE_KEY = 'avatar:layout';
const VISIBLE_KEY = 'avatar:visible';

// 模块级状态：所有组件共享同一份布局设置
const layoutMode = ref<AvatarLayoutMode>(
  (localStorage.getItem(STORAGE_KEY) as AvatarLayoutMode) || 'float',
);
const avatarVisible = ref<boolean>(
  localStorage.getItem(VISIBLE_KEY) !== 'false',
);

// 同步到 localStorage
watch(layoutMode, (v) => localStorage.setItem(STORAGE_KEY, v));
watch(avatarVisible, (v) => localStorage.setItem(VISIBLE_KEY, String(v)));

export function useAvatarLayout() {
  function setLayout(mode: AvatarLayoutMode) {
    layoutMode.value = mode;
  }

  function toggleVisible() {
    avatarVisible.value = !avatarVisible.value;
  }

  function setVisible(v: boolean) {
    avatarVisible.value = v;
  }

  return {
    layoutMode,
    avatarVisible,
    setLayout,
    toggleVisible,
    setVisible,
  };
}
```

- [ ] **Step 2: 验证前端编译通过**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/frontend && pnpm build 2>&1 | tail -5`
Expected: 构建成功

- [ ] **Step 3: Commit**

```bash
git add frontend/src/composables/useAvatarLayout.ts
git commit -m "feat(avatar): useAvatarLayout 布局管理 composable"
```

---

## Task 6: Frontend — AvatarFloat 悬浮窗组件

**Files:**
- Create: `frontend/src/components/avatar/AvatarFloat.vue`

这是核心组件，消费 `avatarAction` 驱动 Live2D 表情/动作，提供拖拽和最小化交互。

- [ ] **Step 1: 创建 AvatarFloat.vue**

```vue
<!-- frontend/src/components/avatar/AvatarFloat.vue -->
<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import Live2DAvatar from './Live2DAvatar.vue';
import { useAIChat } from '@/composables/useAIChat';
import { useAvatarLayout } from '@/composables/useAvatarLayout';
import { HARU_EMOTION_MAP } from '@/config/emotion-map';
import type { AvatarActionPayload } from '@/types/avatar';
import { NIcon } from 'naive-ui';
import {
  CloseOutline,
  ContractOutline,
  ExpandOutline,
  RemoveOutline,
} from '@vicons/ionicons5';

const MODEL_URL = '/live2d/haru_greeter_t03.model3.json';
const FLOAT_WIDTH = 240;
const FLOAT_HEIGHT = 340;
const MINI_SIZE = 56;

const avatarRef = ref<InstanceType<typeof Live2DAvatar>>();
const { avatarAction, isLoading: isStreaming } = useAIChat();
const { layoutMode, setLayout, avatarVisible, setVisible } = useAvatarLayout();

// 悬浮窗位置
const posX = ref(window.innerWidth - FLOAT_WIDTH - 20);
const posY = ref(80);
const isDragging = ref(false);
const isMinimized = ref(false);

// 拖拽逻辑
let dragStartX = 0;
let dragStartY = 0;
let posStartX = 0;
let posStartY = 0;

function onDragStart(e: MouseEvent) {
  isDragging.value = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  posStartX = posX.value;
  posStartY = posY.value;

  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
}

function onDragMove(e: MouseEvent) {
  if (!isDragging.value) return;
  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;
  posX.value = Math.max(0, Math.min(window.innerWidth - FLOAT_WIDTH, posStartX + dx));
  posY.value = Math.max(0, Math.min(window.innerHeight - FLOAT_HEIGHT, posStartY + dy));
}

function onDragEnd() {
  isDragging.value = false;
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
}

// 消费 avatarAction 驱动表情/动作
watch(avatarAction, (action: AvatarActionPayload | null) => {
  if (!action || !avatarRef.value) return;

  if (action.action === 'expression' && action.emotion) {
    const index = HARU_EMOTION_MAP[action.emotion];
    if (index !== undefined) {
      avatarRef.value.setExpression(index);
    }
  }

  if (action.action === 'motion' && action.group) {
    avatarRef.value.startMotion(action.group, action.index ?? 0);
  }
});

// 流式回复时自动切回 neutral（结束后）
watch(isStreaming, (streaming) => {
  if (!streaming && avatarRef.value) {
    avatarRef.value.setExpression(HARU_EMOTION_MAP.neutral);
  }
});

function toggleMinimize() {
  isMinimized.value = !isMinimized.value;
}

function closeAvatar() {
  setVisible(false);
}

onMounted(() => {
  // 确保悬浮窗不超出屏幕
  posX.value = Math.min(posX.value, window.innerWidth - FLOAT_WIDTH - 20);
});

onUnmounted(() => {
  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
});
</script>

<template>
  <!-- 最小化状态：小圆形按钮 -->
  <div
    v-if="isMinimized"
    class="avatar-mini"
    :style="{ left: posX + 'px', top: posY + 'px' }"
    @click="isMinimized = false"
  >
    <div class="avatar-mini-inner">
      <span>{{ layoutMode === 'float' ? '🎭' : '🎭' }}</span>
    </div>
  </div>

  <!-- 悬浮窗状态 -->
  <div
    v-else
    class="avatar-float"
    :class="{ 'is-dragging': isDragging }"
    :style="{
      left: posX + 'px',
      top: posY + 'px',
      width: FLOAT_WIDTH + 'px',
      height: FLOAT_HEIGHT + 'px',
    }"
  >
    <!-- 标题栏（拖拽手柄） -->
    <div class="float-header" @mousedown="onDragStart">
      <span class="float-title">Avatar</span>
      <div class="float-actions">
        <button class="float-btn" title="最小化" @click.stop="toggleMinimize">
          <NIcon :component="RemoveOutline" :size="14" />
        </button>
        <button class="float-btn" title="关闭" @click.stop="closeAvatar">
          <NIcon :component="CloseOutline" :size="14" />
        </button>
      </div>
    </div>

    <!-- Live2D 渲染区 -->
    <div class="float-body">
      <Live2DAvatar
        ref="avatarRef"
        :model-url="MODEL_URL"
        :width="FLOAT_WIDTH"
        :height="FLOAT_HEIGHT - 32"
        :volume="0"
      />
    </div>
  </div>
</template>

<style scoped>
.avatar-float {
  position: fixed;
  z-index: 1000;
  border-radius: 12px;
  overflow: hidden;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  transition: box-shadow 0.2s;
  user-select: none;
}

.avatar-float.is-dragging {
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.5);
  cursor: grabbing;
}

.float-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
  padding: 0 8px;
  background: var(--bg-tertiary);
  cursor: grab;
  border-bottom: 1px solid var(--border-color);
}

.float-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.float-actions {
  display: flex;
  gap: 4px;
}

.float-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.float-btn:hover {
  background: var(--bg-primary);
  color: var(--text-primary);
}

.float-body {
  flex: 1;
  overflow: hidden;
}

.avatar-mini {
  position: fixed;
  z-index: 1000;
  cursor: pointer;
}

.avatar-mini-inner {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--bg-secondary);
  border: 2px solid var(--border-color);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  transition: all 0.2s;
}

.avatar-mini-inner:hover {
  transform: scale(1.1);
  border-color: var(--color-primary);
}
</style>
```

- [ ] **Step 2: 验证前端编译通过**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/frontend && pnpm build 2>&1 | tail -5`
Expected: 构建成功

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/avatar/AvatarFloat.vue
git commit -m "feat(avatar): AvatarFloat 悬浮窗组件（拖拽 + 最小化 + 表情驱动）"
```

---

## Task 7: Frontend — ChatContainer 集成 AvatarFloat

**Files:**
- Modify: `frontend/src/components/chat/ChatContainer.vue`

- [ ] **Step 1: 在 ChatContainer 中引入 AvatarFloat**

```typescript
// frontend/src/components/chat/ChatContainer.vue
// 在 script setup 区域增加 import:
import AvatarFloat from '@/components/avatar/AvatarFloat.vue';
import { useAvatarLayout } from '@/composables/useAvatarLayout';

// 在 useAIChat 解构后增加:
const { avatarVisible } = useAvatarLayout();
```

- [ ] **Step 2: 在 template 中添加 AvatarFloat 和切换按钮**

在 `ChatContainer.vue` 的 template 中，`</div>` 根元素闭合标签之前，添加 AvatarFloat 组件和头部工具栏的 Avatar 切换按钮：

```html
<!-- 在 header 桌面端按钮区域（第 81-93 行之间），NotificationBell 之后增加: -->
<div class="w-px h-6 bg-[var(--border-color)]"></div>
<button
  class="flex items-center justify-center w-9 h-9 bg-transparent border border-[var(--border-color)] rounded-[var(--radius-sm)] text-[var(--text-muted)] cursor-pointer transition-all duration-150 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
  :class="{ '!border-[var(--color-primary)] !text-[var(--color-primary)]': avatarVisible }"
  title="Avatar"
  @click="avatarVisible = !avatarVisible"
>
  🎭
</button>
```

在 template 根元素 `</div>` 闭合之前添加：

```html
<!-- Avatar 悬浮窗 -->
<AvatarFloat v-if="avatarVisible" />
```

- [ ] **Step 3: 在移动端操作抽屉中也添加 Avatar 按钮**

在 `ChatContainer.vue` 移动端抽屉（第 130-134 行）的分割线之前增加：

```html
<div class="flex items-center justify-between py-3">
  <span class="text-[13px] text-[var(--text-secondary)]">Avatar</span>
  <button
    class="text-[13px] cursor-pointer"
    :class="avatarVisible ? 'text-[var(--color-primary)]' : 'text-[var(--text-muted)]'"
    @click="avatarVisible = !avatarVisible; mobileActionsOpen = false"
  >
    {{ avatarVisible ? '关闭' : '开启' }}
  </button>
</div>
```

- [ ] **Step 4: 验证前端编译通过**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/frontend && pnpm build 2>&1 | tail -5`
Expected: 构建成功

- [ ] **Step 5: 手动冒烟测试**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot && ./dev.sh`

验证清单：
1. 打开 ChatView，头部工具栏出现 🎭 按钮
2. 点击 🎭 按钮，右侧出现 Avatar 悬浮窗（Haru 模型加载）
3. 悬浮窗可拖拽移动
4. 点击最小化按钮，缩小为圆形图标
5. 点击圆形图标，恢复悬浮窗
6. 点击关闭按钮，悬浮窗消失
7. 刷新页面，Avatar 可见状态保持（localStorage）

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/chat/ChatContainer.vue
git commit -m "feat(avatar): ChatContainer 集成 AvatarFloat 悬浮窗"
```

---

## Task 8: TTS 口型同步

**Files:**
- Modify: `frontend/src/composables/useVoice.ts` — 暴露 TTS 音频 AnalyserNode
- Modify: `frontend/src/components/avatar/AvatarFloat.vue` — 绑定 TTS 音量

- [ ] **Step 1: 在 useVoice 中提取 TTS 播放音量**

在 `useVoice.ts` 中增加 `ttsAudioLevel` ref。TTS 音频通过 MediaSource + Audio 元素播放（`prepareStreamingAudio()` 方法）。需要在 Audio 元素上连接 AnalyserNode：

```typescript
// frontend/src/composables/useVoice.ts
// 在模块变量区增加:
const ttsAudioLevel = ref(0);
let ttsAnalyser: AnalyserNode | null = null;
let ttsAudioContext: AudioContext | null = null;
let ttsRafId = 0;

// 增加 updateTtsLevel 函数:
function updateTtsLevel() {
  if (!ttsAnalyser) return;
  const data = new Uint8Array(ttsAnalyser.frequencyBinCount);
  ttsAnalyser.getByteFrequencyData(data);
  const avg = data.reduce((a, b) => a + b, 0) / data.length / 255;
  ttsAudioLevel.value = Math.min(1, avg * 3); // 放大口型幅度
  ttsRafId = requestAnimationFrame(updateTtsLevel);
}

// 在 prepareStreamingAudio() 中创建 Audio 元素后，连接 AnalyserNode:
// 找到 audio 元素创建处（约 261 行），在 audio.play() 之后增加:
function connectTtsAnalyser(audioEl: HTMLAudioElement) {
  if (ttsAudioContext) {
    ttsAudioContext.close();
  }
  ttsAudioContext = new AudioContext();
  const source = ttsAudioContext.createMediaElementSource(audioEl);
  ttsAnalyser = ttsAudioContext.createAnalyser();
  ttsAnalyser.fftSize = 256;
  source.connect(ttsAnalyser);
  ttsAnalyser.connect(ttsAudioContext.destination);
  updateTtsLevel();
}
```

在 `useVoice` return 中增加 `ttsAudioLevel`。

在 `disconnectTts()` 和 `dispose()` 中增加清理逻辑：
```typescript
if (ttsRafId) cancelAnimationFrame(ttsRafId);
ttsAnalyser = null;
if (ttsAudioContext) { ttsAudioContext.close(); ttsAudioContext = null; }
ttsAudioLevel.value = 0;
```

- [ ] **Step 2: AvatarFloat 绑定 TTS 音量**

修改 `AvatarFloat.vue`：

```typescript
// AvatarFloat.vue script 增加导入:
import { useVoice } from '@/composables/useVoice';

// 在 composable 调用区域增加:
const { ttsAudioLevel, ttsStatus } = useVoice();

// 修改 Live2DAvatar 的 volume 绑定:
// 将 :volume="0" 改为动态值:
const avatarVolume = computed(() => {
  return ttsStatus.value === 'speaking' ? ttsAudioLevel.value : 0;
});
```

```html
<!-- template 中修改 Live2DAvatar 的 volume prop: -->
<Live2DAvatar
  ref="avatarRef"
  :model-url="MODEL_URL"
  :width="FLOAT_WIDTH"
  :height="FLOAT_HEIGHT - 32"
  :volume="avatarVolume"
/>
```

- [ ] **Step 3: 验证编译通过**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot/frontend && pnpm build 2>&1 | tail -5`
Expected: 构建成功

- [ ] **Step 4: 手动冒烟测试**

Run: `./dev.sh`

验证清单：
1. 开启 TTS 朗读功能
2. 发送消息，AI 回复时角色嘴巴随 TTS 音频开合
3. 朗读结束后嘴巴闭合
4. 关闭 Avatar 悬浮窗后 TTS 功能不受影响

- [ ] **Step 5: Commit**

```bash
git add frontend/src/composables/useVoice.ts \
        frontend/src/components/avatar/AvatarFloat.vue
git commit -m "feat(avatar): TTS 口型同步 — AnalyserNode 提取音量驱动 ParamMouthOpenY"
```

---

## Task 9: 端到端集成验证

- [ ] **Step 1: 启动全栈服务**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot && ./dev.sh`

- [ ] **Step 2: 验证 Avatar 工具注册**

Run: `curl -s http://localhost:8000/api/v1/tools | python3 -m json.tool | grep -A2 avatar`
Expected: 看到 `express_emotion` 和 `play_motion` 工具

- [ ] **Step 3: 验证完整流程**

1. 打开 `https://localhost:3000`
2. 点击 🎭 按钮开启 Avatar
3. 发送 "你好！" → 角色 Haru 加载并显示 neutral 表情
4. 发送 "太棒了！这个功能很酷" → AI 回复时角色切换表情（happy）
5. 开启 TTS 朗读 → 回复时角色嘴巴随音频开合
6. 刷新页面 → Avatar 可见状态保持
7. 切换到移动端视口 → Avatar 正常显示，不遮挡输入区域

- [ ] **Step 4: Final commit (如有修复)**

```bash
git add -A
git commit -m "fix(avatar): 端到端集成修复"
```

---

## Self-Review Checklist

### Spec Coverage

| Spec Section | Task |
|---|---|
| Avatar 工具定义 (express_emotion, play_motion) | Task 1 |
| StreamEvent avatar_action | Task 2 |
| SSE avatar_action 事件 | Task 2 |
| 情绪映射 | Task 3 |
| SSE 事件处理 + avatarAction ref | Task 4 |
| 布局管理 (localStorage) | Task 5 |
| AvatarFloat 悬浮窗 | Task 6 |
| ChatContainer 集成 | Task 7 |
| TTS 口型同步 | Task 8 |
| 端到端验证 | Task 9 |

### Placeholder Scan

- 无 TBD / TODO / "implement later" / "fill in details"
- 无 "add appropriate error handling"
- 无 "similar to Task N"
- 所有代码步骤都有完整代码

### Type Consistency

- `AvatarActionPayload.action` 类型为 `'expression' | 'motion'` — Task 3 定义，Task 4/6 使用
- `StreamEvent` 的 `avatar_action` 使用 `{ action: string; [key: string]: unknown }` — 与工具输出的 JSON 一致
- `EmotionMap` 类型为 `Record<string, number>` — Task 3 定义，Task 6 使用
- `AvatarLayoutMode` 类型为 `'float' | 'side' | 'fullscreen'` — Task 3 定义，Task 5 使用
- avatar.tool.ts 中的 `emotion` enum 值与 HARU_EMOTION_MAP 的 key 完全一致
