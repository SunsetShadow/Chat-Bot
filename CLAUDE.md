# CLAUDE.md

本文件为 Claude Code 在此代码仓库中工作时提供指导。

## 项目概述

Vue 3 + NestJS 聊天应用，使用 [AI SDK](https://ai-sdk.dev)（`ai` + `@ai-sdk/vue`）驱动流式聊天，支持 Agent 角色、规则系统、AI 记忆提取。UI 主题：赛博朋克/霓虹未来主义。

## 规范文档

`docs/specs/` 目录：
- `development/` - 技术栈、目录结构、代码约定
- `core-features/` - 聊天、Agent、规则、记忆、上下文管理
- `agent-architecture/` - Agent 架构评估 + 演进设计方案
- `security/` - 安全规范
- `message-rendering/` - 消息渲染
- `engineering-practice/` - AI 编码 Agent 工程实践方法论

## 开发命令

```bash
./dev.sh                    # 同时启动前后端
cd backend && pnpm dev      # 后端 :3001 (NestJS)
cd frontend && pnpm dev     # 前端 :3000
cd frontend && pnpm build   # 构建
cd frontend && pnpm lint    # ESLint 检查
```

## AI SDK 架构

前端使用 [AI SDK UI](https://ai-sdk.dev/docs/reference/ai-sdk-ui) 驱动聊天：
- `@ai-sdk/vue` 的 `Chat` 类 + 自定义 `ChatTransport` 适配后端 SSE
- 后端 SSE 事件通过 `useChatTransport.ts` 转换为 AI SDK `UIMessageChunk` 格式
- 参考：https://ai-sdk.dev/docs/reference/ai-sdk-ui

## 后端配置

`backend/.env`:
```
LLM_PROVIDER=openai
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o
```
