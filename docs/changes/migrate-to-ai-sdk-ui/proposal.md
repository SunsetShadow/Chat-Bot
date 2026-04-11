# Proposal: AI SDK UI 改造

**Change ID**: `migrate-to-ai-sdk-ui`
**Status**: Completed
**Created**: 2026-04-11

---

## Why

当前聊天界面使用自定义 SSE 连接管理（`useSSE.ts`）和自定义流式聊天逻辑（`useChatStream.ts`），存在以下问题：

1. **维护成本高**：自定义 SSE 解析逻辑与后端协议深度耦合，协议变更时需要多处修改
2. **功能扩展困难**：缺乏标准化的消息格式，添加新的消息类型（如思考过程、工具调用）需要大量适配代码
3. **缺少标准化能力**：未使用社区成熟的 AI SDK，无法享受类型安全、状态管理等开箱即用的能力

## What Changes

### 1. 引入 @ai-sdk/vue

- 安装 `@ai-sdk/vue`（3.0.157）和 `ai`（6.0.157）依赖包
- 使用 AI SDK 提供的 `Chat` 类和 `UIMessage` 标准格式

### 2. 创建自定义 ChatTransport

- 实现 `createChatTransport()` 函数，创建 `ChatTransport<UIMessage>` 实例
- 适配后端自定义 SSE 协议（`message_start` / `content_delta` / `message_done` / `done` / `error`）
- 将 SSE 事件转换为 AI SDK 的 `UIMessageChunk` 格式（`start` / `text-start` / `text-delta` / `text-end` / `finish` / `error`）

### 3. 创建 useAIChat composable

- 封装 `@ai-sdk/vue` 的 `Chat` 类
- 集成自定义 `ChatTransport` 适配后端 SSE
- 提供标准化的 `sendMessage`、`stopStreaming`、`regenerate`、`loadMessages`、`clearMessages` 接口

### 4. 改造消息组件适配 UIMessage

- `MessageList.vue`：从 `useChatStore` 切换到 `useAIChat`，使用 `UIMessage` 格式
- `MessageItem.vue`：从 `message.content` 切换到 `message.parts` 数组，新增思考过程渲染
- `MessageInput.vue`：从 `useChatStream` 切换到 `useAIChat`

### 5. 精简 chat store

- 移除冗余的流式状态（`isStreaming`、`currentStreamingContent`、`currentStreamingMessageId`）
- 移除流式方法（`startStreaming`、`appendStreamingContent`、`stopStreaming` 等）
- 保留会话管理功能

### 6. 清理旧文件

- 删除 `useSSE.ts`（已被 `ChatTransport` 替代）
- 删除 `useChatStream.ts`（已被 `useAIChat` 替代）

## Impact

### 受影响的文件

| 类型 | 文件 | 影响 |
|------|------|------|
| 新增 | `frontend/src/composables/useChatTransport.ts` | 自定义 SSE Transport 适配层 |
| 新增 | `frontend/src/composables/useAIChat.ts` | 封装 Chat 类的 composable |
| 修改 | `frontend/src/components/chat/MessageList.vue` | 适配 UIMessage 格式 |
| 修改 | `frontend/src/components/chat/MessageItem.vue` | 适配 UIMessage parts 渲染 |
| 修改 | `frontend/src/components/chat/MessageInput.vue` | 使用 useAIChat |
| 修改 | `frontend/src/stores/chat.ts` | 移除流式状态管理 |
| 修改 | `frontend/package.json` | 新增 @ai-sdk/vue 和 ai 依赖 |
| 删除 | `frontend/src/composables/useSSE.ts` | 被 ChatTransport 替代 |
| 删除 | `frontend/src/composables/useChatStream.ts` | 被 useAIChat 替代 |

### 受影响的规范

- `docs/specs/core-features/spec.md` - 聊天前端架构变更

### 数据模型变更

```typescript
// 旧格式
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// 新格式（UIMessage）
interface UIMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  parts: UIPart[];  // TextPart | ReasoningPart | SourcePart | ToolCallPart
}
```

### 风险

- **低风险**：AI SDK 版本升级可能引入 breaking changes，需要锁定版本
- **低风险**：自定义 Transport 需要与后端 SSE 协议保持同步

## Scope

**包含**：
- 引入 @ai-sdk/vue 依赖
- 自定义 ChatTransport 适配后端 SSE
- useAIChat composable 封装
- 消息组件 UIMessage 适配
- chat store 精简
- 旧文件清理
- 端到端构建验证

**不包含**：
- 后端 SSE 协议变更（保持现有协议不变）
- AI SDK 高级功能（如多模态、工具调用 UI 增强）
- 会话管理功能变更
