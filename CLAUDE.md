# CLAUDE.md

本文件为 Claude Code 在此代码仓库中工作时提供指导。

## 项目概述

Vue 3 + NestJS 聊天应用，使用 AI SDK 驱动流式聊天，LangGraph Supervisor 模式编排多 Agent 工作流。支持多 Agent 协作与委托、工具权限分级、规则系统、AI 记忆提取与语义检索。UI 主题：赛博朋克/霓虹未来主义。

## 开发命令

```bash
./dev.sh                    # 同时启动前后端
cd backend && pnpm dev      # 后端 :8000 (NestJS)
cd backend && pnpm lint     # 后端 ESLint
cd frontend && pnpm dev     # 前端 :3000
cd frontend && pnpm lint    # 前端 ESLint
```

## 核心数据流

```
用户输入 → useAIChat.sendMessage()
  → ChatTransport → POST /api/v1/chat/completions
  → ChatController → ChatService → LangGraphService
  → Supervisor (按 capabilities 路由) → Worker Agent (createReactAgent + tools)
  → SSE 流 → ChatTransport → UIMessageChunk → Vue 响应式渲染
```

## 后端模块

```
modules/
├── chat/           # 编排层：Controller (SSE) + Service
├── langgraph/      # LangGraph 工作流
│   ├── graph/      #   supervisor.builder.ts — Supervisor 多 Agent 图
│   └── tools/      #   工具系统（registry + loader + collections/ + 业务工具）
├── agent/          # Agent CRUD + 内置定义
├── rule/           # 规则 CRUD
├── memory/         # 记忆（PG + Milvus 双写）
├── model/          # 模型管理
└── upload/         # 文件上传
```

## 环境配置

见 `backend/.env.example`。关键配置项：`OPENAI_*`、`BOCHA_API_KEY`、`MAIL_*`、`DB_*`、`MILVUS_ADDRESS`。

## 详细文档

| 文档 | 内容 |
|------|------|
| [docs/specs/development](docs/specs/development/spec.md) | 技术栈版本、目录结构、命名规范、代码风格、关键文件索引 |
| [docs/specs/core-features](docs/specs/core-features/spec.md) | 聊天/Agent/工具/规则/记忆系统详细规范（数据模型、API、约束） |
| [docs/specs/message-rendering](docs/specs/message-rendering/spec.md) | 消息渲染规范 |
| [docs/specs/security](docs/specs/security/spec.md) | 安全规范（输入验证、安全头、速率限制） |
| [docs/plans/](docs/plans/) | 未来演进计划 |

## 已知问题

- `llm/` 模块是遗留代码，待清理
- 无 token 计算、消息截断、滑动窗口
- HITL 确认机制、Agent 协作可视化未实现
