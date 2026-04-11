# CLAUDE.md

本文件为 Claude Code 在此代码仓库中工作时提供指导。

## 项目概述

Vue 3 + NestJS 聊天应用，使用 [AI SDK](https://ai-sdk.dev)（`ai` + `@ai-sdk/vue`）驱动流式聊天，后端使用 [LangGraph](https://langchain-ai.github.io/langgraphjs/) 编排 Agent 工作流。支持 Agent 角色、规则系统、AI 记忆提取。UI 主题：赛博朋克/霓虹未来主义。

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | Vue 3.5 + TypeScript 5.9 + Vite 8 + Pinia 3 + Naive UI + Tailwind CSS 4 |
| 后端 | NestJS 11 + TypeScript 5 + Node.js 20+ |
| AI 前端 | `ai` 6 + `@ai-sdk/vue` 3 — Chat 类 + 自定义 ChatTransport |
| AI 后端 | `@langchain/langgraph` 1.2 + `@langchain/openai` 1.4 — StateGraph + ChatOpenAI |
| 包管理 | pnpm 10（前后端共用） |

## 文档目录

- `docs/specs/` — 当前系统规范（已实现）
- `docs/plans/` — 未来演进计划（未实现）
- `docs/references/` — 参考读物
- `docs/changes/` — 历史变更记录

## 开发命令

```bash
./dev.sh                    # 同时启动前后端
cd backend && pnpm dev      # 后端 :3001 (NestJS)
cd frontend && pnpm dev     # 前端 :3000
cd frontend && pnpm build   # 构建
cd frontend && pnpm lint    # ESLint 检查
```

## 核心数据流

```
用户输入 → useAIChat.sendMessage()
  → ChatTransport.sendMessages() → POST /api/v1/chat/completions
  → ChatController → ChatService → LangGraphService
  → LangGraph StateGraph (agent → [tools?] → agent → ...)
  → SSE 流 → ChatTransport.convertSSEStream() → UIMessageChunk
  → Chat 实例自动更新 messages → Vue 响应式渲染
```

## 后端架构

```
modules/
├── chat/           # 编排层：ChatController (SSE) + ChatService
├── langgraph/      # LangGraph 工作流
│   ├── graph/      #   graph.builder.ts + nodes/
│   └── tools/      #   memory-extract.tool.ts（空壳，待修复）
├── agent/          # Agent CRUD + 内置定义
├── rule/           # 规则 CRUD
├── memory/         # 记忆 CRUD + 上下文构建
├── llm/            # LLM Provider（死代码，与 langgraph/ 重复）
├── model/          # 模型管理
└── upload/         # 文件上传
```

## 前端关键文件

| 文件 | 用途 |
|------|------|
| `composables/useAIChat.ts` | AI SDK Chat 实例（单例），sendMessage / stopStreaming / regenerate |
| `composables/useChatTransport.ts` | 自定义 ChatTransport，SSE → UIMessageChunk 转换 |
| `stores/chat.ts` | Pinia store，会话列表和当前会话状态 |
| `api/chat.ts` | REST API 调用（会话 CRUD、消息历史） |
| `views/ChatView.vue` | 主聊天页面 |
| `components/chat/` | 聊天 UI 组件 |

## 后端配置

`backend/.env`:
```
LLM_PROVIDER=openai
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o
```

## 已知问题

- 所有数据存内存 Map，重启丢失
- `llm/` 模块是死代码，与 `langgraph/` 重复
- `memory-extract.tool.ts` 是空壳，未调用 MemoryService
- 无 token 计算、消息截断、滑动窗口
- 完整评估见 `docs/plans/agent-architecture/evolution-plan.md`
