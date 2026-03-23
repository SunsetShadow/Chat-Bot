# 开发指南规范

## 概述

本文档定义 Chat Bot 项目的技术栈、代码约定、目录结构和开发工作流。

## 技术栈

### 前端

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | Vue 3 | ^3.5 |
| 语言 | TypeScript | ~5.9 |
| 构建工具 | Vite | ^8.0 |
| 状态管理 | Pinia | ^3.0 |
| UI 组件库 | Naive UI | ^2.44 |
| CSS 框架 | Tailwind CSS | ^4.2 |
| 路由 | Vue Router | ^5.0 |
| 代码检查 | ESLint | ^10.1 |

### 后端

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | FastAPI | - |
| 语言 | Python | 3.12+ |
| 包管理 | uv | - |
| 数据库 | SQLite + SQLAlchemy | - |
| AI | OpenAI API | - |

## 目录结构

```
Chat-Bot/
├── frontend/                    # 前端项目
│   ├── src/
│   │   ├── api/                 # API 调用层
│   │   ├── assets/              # 静态资源（CSS、图片）
│   │   ├── components/          # Vue 组件
│   │   │   ├── agent/           # Agent 相关组件
│   │   │   ├── chat/            # 聊天相关组件
│   │   │   ├── common/          # 通用组件
│   │   │   └── rules/           # 规则相关组件
│   │   ├── composables/         # Vue Composables
│   │   ├── layouts/             # 布局组件
│   │   ├── stores/              # Pinia 状态管理
│   │   ├── types/               # TypeScript 类型定义
│   │   ├── utils/               # 工具函数
│   │   └── views/               # 页面视图
│   ├── eslint.config.js         # ESLint 配置
│   └── package.json             # 依赖配置
│
├── backend/                     # 后端项目
│   ├── app/
│   │   ├── api/v1/              # API 路由
│   │   ├── core/                # 核心配置
│   │   ├── models/              # 数据模型
│   │   ├── repositories/        # 数据访问层
│   │   ├── schemas/             # Pydantic 模式
│   │   ├── services/            # 业务逻辑层
│   │   │   └── llm/             # LLM 提供者
│   │   └── utils/               # 工具函数
│   └── pyproject.toml           # 依赖配置
│
└── openspec/                    # 规范文档
    ├── specs/                   # 功能规范
    └── changes/                 # 变更提案
```

## 代码约定

### 前端约定

**命名规范**
- 组件文件：PascalCase（如 `ChatView.vue`、`MessageItem.vue`）
- Composables：camelCase，以 `use` 开头（如 `useChatStream.ts`）
- Store 文件：camelCase（如 `chat.ts`、`agent.ts`）
- 类型文件：统一在 `src/types/index.ts` 中定义

**组件结构**
```vue
<script setup lang="ts">
// 1. 导入
// 2. Props/Emits 定义
// 3. 响应式状态
// 4. 计算属性
// 5. 方法
// 6. 生命周期钩子
</script>

<template>
  <!-- 模板内容 -->
</template>

<style scoped>
/* 样式 */
</style>
```

**状态管理**
- Store 放在 `src/stores/` 目录
- API 调用放在 `src/api/` 目录，不在 Store 中直接调用 fetch

### 后端约定

**命名规范**
- 文件：snake_case（如 `chat_service.py`）
- 类：PascalCase（如 `ChatService`）
- 函数/变量：snake_case（如 `get_chat_messages`）

**分层架构**
```
API Routes (app/api/v1/)
    ↓ 调用
Services (app/services/)
    ↓ 调用
Repositories (app/repositories/)
    ↓ 操作
Models (app/models/)
```

**LLM Provider 模式**
- 抽象基类：`BaseLLMProvider`
- 具体实现：`OpenAIProvider`
- 工厂方法：`get_default_llm_provider()`

## 开发命令

### 前端

```bash
cd frontend

# 开发
pnpm dev              # 启动开发服务器 (http://localhost:3000)

# 构建
pnpm build            # 生产构建
pnpm preview          # 预览构建结果

# 代码质量
pnpm lint             # ESLint 检查
pnpm lint:fix         # ESLint 自动修复
```

### 后端

```bash
cd backend

# 开发
uv run fastapi dev app/main.py    # 启动开发服务器 (http://localhost:8000)

# API 文档
# 访问 http://localhost:8000/docs 查看 Swagger UI
```

### 同时启动

```bash
./dev.sh              # 同时启动前端和后端
```

## 环境配置

### 前端

无需配置，Vite 自动处理。

### 后端

在 `backend/.env` 文件中配置：

```env
LLM_PROVIDER=openai
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o
```

## UI 主题

赛博朋克/霓虹未来主义主题，CSS 变量定义在 `frontend/src/assets/main.css`：

| 变量 | 用途 | 色值 |
|------|------|------|
| `--neon-cyan` | 主强调色 | #00f5ff |
| `--neon-purple` | 次强调色 | #bf00ff |
| `--bg-primary` | 主背景 | #0a0a0f |
| `--bg-secondary` | 次背景 | #1a1a2e |

**样式类**
- `.glass-card` - 玻璃拟态效果
- `.neon-text` - 发光文字效果
- `.neon-border` - 霓虹边框

## 关键文件

| 路径 | 用途 |
|------|------|
| `frontend/src/types/index.ts` | 所有 TypeScript 接口定义 |
| `frontend/src/api/chat.ts` | API 函数 + SSE 流处理 |
| `frontend/src/composables/useSSE.ts` | SSE 解析逻辑 |
| `backend/app/services/chat_service.py` | 核心聊天逻辑 |
| `backend/app/services/memory_service.py` | AI 记忆提取 |
| `backend/app/services/llm/base.py` | LLM 提供者抽象 |

## 约束

1. 前端使用 `<script setup lang="ts">` 语法
2. 所有聊天消息通过 SSE 流式传输
3. 后端业务逻辑放在 Services 层，不在路由中直接编写
4. Agent 和 Rule 在请求时注入到系统提示词
5. 会话持久化存储在本地文件系统
