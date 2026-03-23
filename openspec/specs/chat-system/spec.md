# 聊天系统核心功能规范

## 概述

Chat Bot 的聊天系统是基于 Server-Sent Events (SSE) 的实时流式聊天系统，支持多 Agent 角色切换和规则系统。

## 技术架构

### 前端 (Vue 3)
- **框架**: Vue 3 + TypeScript + Pinia
- **UI 主题**: 赛博朋克/霓虹未来主义
- **流式传输**: 通过 SSE 接收实时消息

### 后端 (FastAPI)
- **框架**: FastAPI + Python
- **LLM Provider**: 抽象提供者模式，支持 OpenAI 兼容接口
- **事件格式**: SSE 事件流

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

## 约束

1. 所有聊天消息必须通过 SSE 流式传输
2. Agent 和 Rule 在请求时注入到系统提示词
3. 会话持久化存储在本地文件系统
