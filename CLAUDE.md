# CLAUDE.md

本文件为 Claude Code 在此代码仓库中工作时提供指导。

## 项目概述

Vue 3 + FastAPI 聊天应用，支持 Agent 角色、规则系统、AI 记忆提取。UI 主题：赛博朋克/霓虹未来主义。

## 规范文档

`openspec/specs/` 目录：
- `development/` - 技术栈、目录结构、代码约定
- `core-features/` - 聊天、Agent、规则、记忆、上下文管理
- `security/` - 安全规范
- `message-rendering/` - 消息渲染

## 开发命令

```bash
./dev.sh                    # 同时启动前后端
cd backend && uv run fastapi dev app/main.py  # 后端 :8000
cd frontend && pnpm dev     # 前端 :3000
cd frontend && pnpm build   # 构建
cd frontend && pnpm lint    # ESLint 检查
```

API 文档: http://localhost:8000/docs

## 后端配置

`backend/.env`:
```
LLM_PROVIDER=openai
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o
```
