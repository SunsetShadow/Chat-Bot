# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此代码仓库中工作时提供指导。

## 项目概述

Chat Bot 是一个基于 Vue 3 + FastAPI 的聊天应用，支持 Agent 角色配置、规则系统和 AI 驱动的记忆提取。UI 采用赛博朋克/霓虹未来主义主题。

## 规范文档

所有功能规范、架构设计和需求文档位于 `openspec/specs/` 目录：

| 目录 | 说明 |
|------|------|
| `openspec/specs/development-guide/` | **技术栈、目录结构、代码约定、开发命令** |
| `openspec/specs/chat-system/` | 聊天系统规范 |
| `openspec/specs/agent-system/` | Agent 系统规范 |
| `openspec/specs/rule-system/` | 规则系统规范 |
| `openspec/specs/memory-system/` | 记忆系统规范 |

## 开发命令

### 启动开发服务器

```bash
# 同时启动前端和后端
./dev.sh

# 或单独运行：
# 后端 (FastAPI 运行于 http://localhost:8000)
cd backend && uv run fastapi dev app/main.py

# 前端 (Vite 运行于 http://localhost:3000)
cd frontend && pnpm dev
```

### 构建与检查

```bash
# 前端构建
cd frontend && pnpm build

# 前端预览
cd frontend && pnpm preview

# ESLint 检查
cd frontend && pnpm lint

# ESLint 自动修复
cd frontend && pnpm lint:fix
```

### API 文档

- 后端 API 文档: http://localhost:8000/docs (Swagger UI)
- API 基础路径: `/api/v1/`

## 后端配置

环境变量 (在 `backend/` 目录下的 `.env` 文件中):
```
LLM_PROVIDER=openai
OPENAI_API_KEY=your-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o
```
