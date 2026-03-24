# 聊天系统核心功能规范

## 概述

Chat Bot 的聊天系统是基于 Server-Sent Events (SSE) 的实时流式聊天系统，支持多 Agent 角色切换和规则系统。

## 数据流

```
用户输入 → API 请求 → LLM Provider → SSE 流式响应 → 前端渲染
```

## SSE 事件类型

| 事件类型 | 描述 |
|---------|------|
| `message_start` | 新消息开始 |
| `content_delta` | 内容块增量 |
| `message_done` | 消息完成 |
| `done` | 会话完成 |

## API 端点

- `POST /api/v1/chat/completions` - 发送聊天消息（SSE 流式）
- `GET /api/v1/sessions` - 获取会话列表
- `GET /api/v1/sessions/{id}` - 获取特定会话
- `DELETE /api/v1/sessions/{id}` - 删除会话

## 关键文件

| 路径 | 用途 |
|------|------|
| `frontend/src/composables/useSSE.ts` | SSE 解析逻辑 |
| `frontend/src/api/chat.ts` | API 调用和流处理 |
| `backend/app/api/v1/chat.py` | 聊天 API 路由 |
| `backend/app/services/chat_service.py` | 核心聊天逻辑 |

## 错误处理与重连

### SSE 连接错误处理

| 错误类型 | 处理策略 |
|---------|---------|
| 连接超时 | 30秒无响应自动重连，最多3次 |
| 网络中断 | 指数退避重连（1s, 2s, 4s, 8s） |
| 服务端错误 | 显示错误提示，保留用户输入 |
| Token 过期 | 提示重新认证 |

### 消息重试策略

```typescript
interface RetryConfig {
  maxRetries: number      // 最大重试次数，默认 3
  baseDelay: number       // 基础延迟 ms，默认 1000
  maxDelay: number        // 最大延迟 ms，默认 10000
  retryableErrors: string[] // 可重试的错误码
}

// 用户可手动重试失败的消息
```

### 连接状态管理

```typescript
type ConnectionState =
  | 'connecting'    // 正在连接
  | 'connected'     // 已连接
  | 'disconnected'  // 已断开
  | 'reconnecting'  // 重连中
  | 'error'         // 错误状态
```

## 约束

1. 所有聊天消息必须通过 SSE 流式传输
2. Agent 和 Rule 在请求时注入到系统提示词
3. 会话持久化存储在本地文件系统
4. SSE 连接超时设为 30 秒
5. 失败消息保留在本地，支持手动重试
