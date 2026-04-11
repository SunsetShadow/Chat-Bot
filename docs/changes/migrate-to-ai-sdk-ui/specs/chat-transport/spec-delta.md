# Spec Delta: AI SDK UI 改造

**Change ID**: `migrate-to-ai-sdk-ui`
**Target Spec**: `docs/specs/core-features/spec.md`

---

## ADDED Requirements

### Requirement: ChatTransport 适配层
系统 SHALL 通过自定义 ChatTransport 将后端 SSE 协议转换为 AI SDK UIMessage 格式。

#### Scenario: 发送消息
GIVEN 用户在聊天界面
WHEN 用户发送消息
THEN ChatTransport 将 UIMessage 格式转换为后端 ChatCompletionRequest
AND 发起 SSE 请求到后端

#### Scenario: 接收流式响应
GIVEN 后端返回 SSE 事件流
WHEN ChatTransport 接收到事件
THEN message_start 事件转换为 UIMessageChunk start
AND content_delta 事件转换为 text-start + text-delta + text-end
AND message_done 事件转换为 finish
AND done 事件标记流式结束
AND error 事件转换为 UIMessageChunk error

#### Scenario: SSE 事件格式映射

| 后端 SSE 事件 | AI SDK UIMessageChunk |
|---------------|----------------------|
| message_start | start |
| content_delta | text-start → text-delta → text-end |
| message_done | finish |
| done | 流结束 |
| error | error |

### Requirement: useAIChat composable
系统 SHALL 提供 useAIChat composable 封装 AI SDK Chat 类，提供标准化的聊天接口。

#### Scenario: 发送消息
GIVEN useAIChat 已初始化
WHEN 调用 sendMessage(text, options)
THEN 消息通过 ChatTransport 发送到后端
AND 响应实时更新到 messages 响应式状态
AND 消息同步到 chatStore

#### Scenario: 停止流式
GIVEN AI 正在流式响应
WHEN 调用 stopStreaming()
THEN 流式请求被中断
AND 已接收的内容保留在 messages 中

#### Scenario: 重新生成
GIVEN 有至少一条助手消息
WHEN 调用 regenerate()
THEN 最后一条助手消息被删除
AND 重新发送最后一条用户消息

#### Scenario: 加载历史消息
GIVEN useAIChat 已初始化
WHEN 调用 loadMessages(messages)
THEN 历史消息加载到 Chat 实例中

### Requirement: UIMessage parts 渲染
消息组件 SHALL 支持 UIMessage 的 parts 数组渲染。

#### Scenario: 渲染文本内容
GIVEN 消息包含 TextPart
WHEN MessageItem 渲染消息
THEN 文本内容通过 Markdown 渲染
AND 代码块支持语法高亮

#### Scenario: 渲染思考过程
GIVEN 消息包含 ReasoningPart
WHEN MessageItem 渲染消息
THEN 在消息内容前显示思考过程区域
AND 思考过程使用可折叠区域展示

---

## MODIFIED Requirements

### Requirement: 消息列表状态管理
消息列表 SHALL 使用 useAIChat 管理消息和流式状态。

#### Scenario: 消息列表渲染
GIVEN 用户打开聊天界面
WHEN 消息列表加载
THEN 使用 useAIChat 的 messages（UIMessage 格式）
AND 不再使用 chatStore.messages

#### Scenario: 流式状态检测
GIVEN AI 正在流式响应
WHEN 消息列表更新
THEN 使用 useAIChat 的 isLoading 检测流式状态
AND 通过 isStreaming prop 传递给最后一条助手消息

### Requirement: chat store 职责精简
chat store SHALL 仅负责会话管理，不再管理流式状态。

#### Scenario: 会话管理保留
GIVEN chat store 初始化
WHEN 调用会话相关方法
THEN sessions, currentSession, fetchSessions, createSession, selectSession, removeSession, pinSession 正常工作

#### Scenario: 流式状态移除
GIVEN 消息发送和接收
WHEN 检查 chat store
THEN 不包含 isStreaming, currentStreamingContent, currentStreamingMessageId
AND 不包含 startStreaming, appendStreamingContent, stopStreaming 方法

---

## Architecture Changes

### 依赖变更

```json
{
  "dependencies": {
    "@ai-sdk/vue": "^3.0.157",
    "ai": "^6.0.157"
  }
}
```

### 文件变更

| 操作 | 文件 | 说明 |
|------|------|------|
| 新增 | `frontend/src/composables/useChatTransport.ts` | 自定义 SSE Transport |
| 新增 | `frontend/src/composables/useAIChat.ts` | Chat 类封装 composable |
| 修改 | `frontend/src/components/chat/MessageList.vue` | UIMessage 适配 |
| 修改 | `frontend/src/components/chat/MessageItem.vue` | parts 数组渲染 |
| 修改 | `frontend/src/components/chat/MessageInput.vue` | useAIChat 切换 |
| 修改 | `frontend/src/stores/chat.ts` | 移除流式状态 |
| 删除 | `frontend/src/composables/useSSE.ts` | 被 ChatTransport 替代 |
| 删除 | `frontend/src/composables/useChatStream.ts` | 被 useAIChat 替代 |
