# AI SDK UI 参考文档

> 来源: https://ai-sdk.dev/docs/reference/ai-sdk-ui/
> 版本: AI SDK 6.x (Latest)
> 生成日期: 2026-04-21

## 概述

AI SDK UI 是 Vercel 提供的框架无关型工具包，用于快速构建交互式聊天、文本补全和 AI 助手应用。它封装了流式传输、状态管理、UI 自动更新等复杂逻辑，让开发者专注于业务层。

## 框架支持

| 框架 | 包名 | useChat | useCompletion | useObject |
|------|------|---------|---------------|-----------|
| React | `@ai-sdk/react` | ✅ | ✅ | ✅ |
| Vue.js | `@ai-sdk/vue` | ✅ | ✅ | ✅ |
| Svelte | `@ai-sdk/svelte` | ✅ | ✅ | ✅ |
| Angular | `@ai-sdk/angular` | ✅ | ✅ | ✅ |
| SolidJS | 社区包 | ✅ | ✅ | ✅ |

---

## 核心 Hooks

### 1. useChat

构建对话式 UI 的主 hook。管理聊天消息状态、流式接收 AI 回复、工具调用、消息重新生成等。

```ts
import { useChat } from '@ai-sdk/vue' // Vue
import { useChat } from '@ai-sdk/react' // React
```

#### 关键参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `api` | `string` | 后端 API 端点，默认 `/api/chat` |
| `credentials` | `RequestCredentials` | fetch 凭证模式 |
| `headers` | `Record<string, string> \| Headers` | 请求头 |
| `body` | `Record<string, any>` | 请求体额外字段 |
| `onToolCall` | `({toolCall}) => void` | 工具调用回调 |
| `onFinish` | `(options: OnFinishOptions) => void` | 流式响应完成回调 |
| `onError` | `(error: Error) => void` | 错误回调 |
| `onData` | `(dataPart) => void` | 自定义数据部分回调 |
| `sendAutomaticallyWhen` | `(options) => boolean` | 自动发送条件 |
| `experimental_throttle` | `number` | 流式更新节流 (ms) |

#### 关键返回值

| 属性 | 类型 | 说明 |
|------|------|------|
| `messages` | `UIMessage[]` | 当前消息列表 |
| `sendMessage` | `(message, options?) => Promise<void>` | 发送消息（支持文本、文件、元数据） |
| `regenerate` | `(options?) => Promise<void>` | 重新生成指定消息 |
| `addToolOutput` | `(options) => void` | 添加工具执行结果 |
| `addToolApprovalResponse` | `(options) => void` | 工具审批响应（人工确认） |
| `setMessages` | `(messages) => void` | 手动设置消息列表 |
| `error` | `Error \| undefined` | 当前错误 |
| `status` | `'submitted' \| 'streaming' \| 'ready' \| 'error'` | 当前状态 |

#### UIMessage 结构

```ts
interface UIMessage {
  role: 'system' | 'user' | 'assistant'
  status: 'submitted' | 'streaming' | 'ready' | 'error'
  // ... 其他字段
}
```

---

### 2. useCompletion

文本补全 hook，适用于单轮补全场景（如代码补全、文本续写）。

```ts
import { useCompletion } from '@ai-sdk/react'
```

#### 关键参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `api` | `string` | API 端点，默认 `/api/completion` |
| `initialInput` | `string` | 初始输入值 |
| `initialCompletion` | `string` | 初始补全结果 |
| `onFinish` | `(prompt, completion) => void` | 完成回调 |
| `onError` | `(error: Error) => void` | 错误回调 |
| `streamProtocol` | `'text' \| 'data'` | 流协议类型 |

#### 关键返回值

| 属性 | 类型 | 说明 |
|------|------|------|
| `completion` | `string` | 当前补全文本 |
| `complete` | `(prompt, options?) => Promise<string>` | 触发补全 |
| `stop` | `() => void` | 中止请求 |
| `input` | `string` | 当前输入 |
| `setInput` | `Dispatch` | 设置输入 |
| `handleInputChange` | `(event) => void` | 输入变更处理器 |
| `handleSubmit` | `(event?) => void` | 表单提交处理器 |
| `isLoading` | `boolean` | 是否加载中 |
| `error` | `Error \| undefined` | 当前错误 |

---

### 3. useObject（实验性）

消费流式 JSON 对象并按 schema 解析为完整对象。需配合后端 `streamText` + `Output.object()` 使用。

```ts
import { experimental_useObject as useObject } from '@ai-sdk/react'
```

#### 关键参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `api` | `string` | API 端点 |
| `schema` | `Zod Schema \| JSON Schema` | 输出对象的 schema 定义 |
| `initialValue` | `DeepPartial<RESULT>` | 初始值 |
| `onFinish` | `(result: OnFinishResult) => void` | 完成回调 |
| `onError` | `(error: Error) => void` | 错误回调 |

#### 关键返回值

| 属性 | 类型 | 说明 |
|------|------|------|
| `object` | `DeepPartial<RESULT> \| undefined` | 当前解析的对象（逐步更新） |
| `submit` | `(input) => void` | 提交请求 |
| `stop` | `() => void` | 中止请求 |
| `clear` | `() => void` | 清空状态 |
| `isLoading` | `boolean` | 是否加载中 |
| `error` | `Error \| undefined` | 当前错误 |

---

## 服务端工具函数

### 4. createUIMessageStream

创建 UI 消息的可读流，支持消息合并、错误处理和完成回调。

```ts
import { createUIMessageStream } from 'ai'
```

```ts
const stream = createUIMessageStream({
  async execute({ writer }) {
    // 手动写入文本块
    writer.write({ type: 'text-start', id: 'example-text' })
    writer.write({ type: 'text-delta', id: 'example-text', delta: 'Hello' })
    writer.write({ type: 'text-end', id: 'example-text' })

    // 合并 streamText 产生的流
    const result = streamText({
      model: 'anthropic/claude-sonnet-4.5',
      prompt: 'Write a haiku about AI',
    })
    writer.merge(result.toUIMessageStream())
  },
  onError: (error) => `Custom error: ${error.message}`,
  originalMessages: existingMessages,
  onFinish: ({ messages, isContinuation, responseMessage }) => {
    console.log('Stream finished:', messages)
  },
})
```

#### 关键参数

| 参数 | 类型 | 说明 |
|------|------|------|
| `execute` | `({ writer }) => Promise<void>` | 写入逻辑，通过 writer 写入流 |
| `onError` | `(error) => string` | 错误处理器 |
| `originalMessages` | `UIMessage[]` | 原始消息（启用持久化模式） |
| `onFinish` | `(options) => void` | 流完成回调，含 messages、isContinuation、isAborted、finishReason |

#### UIMessageStreamWriter 方法

| 方法 | 说明 |
|------|------|
| `write(part: UIMessageChunk)` | 写入单个消息块 |
| `merge(stream)` | 合并另一个 UI 消息流 |

---

### 5. createUIMessageStreamResponse

基于 `createUIMessageStream` 创建标准 Response 对象，直接返回给客户端。

```ts
import { createUIMessageStreamResponse } from 'ai'
```

---

### 6. pipeUIMessageStreamToResponse

将 UI 消息流管道至 Node.js ServerResponse 对象。

```ts
import { pipeUIMessageStreamToResponse } from 'ai'
```

---

### 7. readUIMessageStream

将 `UIMessageChunk` 流转换为 `UIMessage` 对象的 AsyncIterableStream。

```ts
import { readUIMessageStream } from 'ai'
```

---

## 辅助函数

### 8. convertToModelMessages

将 `useChat` 的消息格式转换为 AI Core 函数所需的 `ModelMessages` 格式。

```ts
import { convertToModelMessages } from 'ai'
```

### 9. pruneMessages

裁剪模型消息列表，控制发送给 LLM 的上下文长度。

```ts
import { pruneMessages } from 'ai'
```

---

## 类型工具

### InferUITools / InferUITool

从工具定义中推断 UI 层类型，确保前后端工具类型一致。

```ts
import type { InferUITools, InferUITool } from 'ai'
```

### DirectChatTransport

直接调用本地 AI 函数（不经过网络），适用于 SSR 或测试场景。

---

## Transport 架构（AI SDK 5.0+）

`useChat` 采用 Transport 架构，解耦了通信层与状态管理：

- **DefaultChatTransport**：基于 HTTP fetch 的标准实现
- **自定义 Transport**：可实现 WebSocket、SSE 等自定义通信方式

关键 transport 参数：
- `api` — 请求端点
- `credentials` — 凭证策略
- `headers` — 请求头
- `prepareSendMessagesRequest` — 发送前自定义请求
- `prepareReconnectToStreamRequest` — 重连流式请求

---

## 流协议（Stream Protocols）

AI SDK UI 支持两种流协议：

| 协议 | 说明 | 适用场景 |
|------|------|----------|
| **UIMessage Stream** | 结构化消息流，支持工具调用、元数据、多部分内容 | useChat（推荐） |
| **Text Stream** | 纯文本流 | useCompletion |

---

## 典型使用模式

### 聊天机器人

```ts
// 前端 (Vue)
const { messages, sendMessage, status } = useChat({
  api: '/api/v1/chat/completions',
  onFinish: ({ finishReason }) => { /* ... */ },
})

// 后端 (NestJS/Node)
const result = streamText({ model, messages, tools })
return createUIMessageStreamResponse({
  stream: result.toUIMessageStream(),
})
```

### 结构化对象生成

```ts
// 前端
const { object, submit } = useObject({
  api: '/api/generate',
  schema: z.object({ title: z.string(), items: z.array(z.string()) }),
})

// 后端
const result = streamText({
  model,
  prompt,
  output: Output.object({ schema }),
})
```

### 消息持久化

使用 `originalMessages` + `onFinish` 回调实现消息存储：

```ts
const stream = createUIMessageStream({
  originalMessages: loadedMessages,
  onFinish: async ({ messages, responseMessage }) => {
    await saveMessages(messages)
  },
  // ...
})
```

---

## 与本项目的关联

本项目 (Chat-Bot) 使用 `@ai-sdk/vue` 的 `useChat` hook，配合自定义 `ChatTransport` 实现 SSE 流式通信。后端通过 NestJS `ChatController` 接收请求，经 `LangGraphService` 编排多 Agent 工作流，最终以 SSE 流返回结果。

关键对应关系：
- 前端 `useChat` → `ChatTransport` → `POST /api/v1/chat/completions`
- 后端 `ChatController` → `ChatService` → `LangGraphService.getGraph()`
- SSE 流 → `UIMessageChunk` → Vue 响应式渲染
