# 开发规范

## 技术栈

### 前端

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | Vue 3 | ^3.5 |
| 语言 | TypeScript | ~5.9 |
| 样式 | Tailwind CSS（不要写自定义 CSS）| ^4.2.2 |
| 构建工具 | Vite | ^8.0 |
| 状态管理 | Pinia | ^3.0 |
| UI 组件库 | Naive UI | ^2.44 |
| 路由 | Vue Router | ^5.0 |
| 代码检查 | ESLint | ^10.1 |
| 包管理 | pnpm | ^10.26.2 |

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
│   │   ├── assets/              # 静态资源
│   │   ├── components/          # Vue 组件
│   │   │   ├── agent/           # Agent 相关组件
│   │   │   ├── chat/            # 聊天相关组件
│   │   │   ├── common/          # 通用组件
│   │   │   └── rules/           # 规则相关组件
│   │   ├── composables/         # Vue Composables
│   │   ├── stores/              # Pinia 状态管理
│   │   ├── types/               # TypeScript 类型定义
│   │   └── utils/               # 工具函数
│   └── package.json
│
├── backend/                     # 后端项目
│   ├── app/
│   │   ├── agents/              # Agent 模块（自包含）
│   │   │   ├── prompts/         # 内置 Agent 定义
│   │   │   ├── routes.py        # Agent API 路由
│   │   │   ├── schemas.py       # Agent 数据模型
│   │   │   └── service.py       # Agent 业务逻辑
│   │   ├── api/v1/              # API 路由
│   │   ├── core/                # 核心配置
│   │   ├── models/              # 数据模型
│   │   ├── repositories/        # 数据访问层
│   │   ├── schemas/             # Pydantic 模式
│   │   ├── services/            # 业务逻辑层
│   │   │   └── llm/             # LLM 提供者
│   │   └── utils/               # 工具函数
│   └── pyproject.toml
│
└── openspec/                    # 规范文档
```

## 命名规范

### 前端

| 类型 | 规范 | 示例 |
|------|------|------|
| 组件文件 | PascalCase | `ChatView.vue`、`MessageItem.vue` |
| Composables | camelCase，以 use 开头 | `useChatStream.ts` |
| Store 文件 | camelCase | `chat.ts`、`agent.ts` |
| 类型定义 | 统一在 `src/types/index.ts` | - |

### 后端

| 类型 | 规范 | 示例 |
|------|------|------|
| 文件 | snake_case | `chat_service.py` |
| 类 | PascalCase | `ChatService` |
| 函数/变量 | snake_case | `get_chat_messages` |

## 分层架构

```
API Routes (app/api/v1/)
    ↓ 调用
Services (app/services/)
    ↓ 调用
Repositories (app/repositories/)
    ↓ 操作
Models (app/models/)
```

## 代码风格约束

| 约束 | 说明 |
|------|------|
| 函数长度 | 不超过 30 行（复杂算法除外） |
| 参数数量 | 不超过 3 个，超过时使用配置对象 |
| 嵌套深度 | 最多 3 层，使用早期返回减少嵌套 |
| 类型注解 | 公共 API 必须有类型注解 |
| Lint 检查 | 所有代码必须通过 ESLint/Ruff |

## UI 风格约束

### 样式规范

| 约束 | 说明 |
|------|------|
| CSS 框架 | 使用 Tailwind CSS，不写自定义 CSS |
| 组件库 | Naive UI 组件为主，自定义组件为辅 |
| CSS 变量 | 使用 `main.css` 中定义的 CSS 变量 |
| 字体 | Sora（正文）、JetBrains Mono（代码） |

### CSS 变量使用

颜色、阴影、圆角等使用 `main.css` 中的 CSS 变量，而非硬编码值：

- 颜色：`--color-primary`、`--bg-primary`、`--text-primary` 等
- 阴影：`--shadow-sm`、`--shadow-md`、`--shadow-lg`
- 圆角：`--radius-sm`、`--radius-md`、`--radius-lg`
- 过渡：`--transition-fast`、`--transition-smooth`

### 约束

1. 不在组件 `<style>` 中写自定义 CSS，使用 Tailwind 类或 CSS 变量
2. 新增颜色必须通过 CSS 变量定义
3. 动画使用 `main.css` 中定义的 keyframes
4. 滚动条样式已在 `main.css` 中定义，无需重复

## 关键文件

| 路径 | 用途 |
|------|------|
| `frontend/src/assets/main.css` | CSS 变量和全局样式 |
| `frontend/src/types/index.ts` | 所有 TypeScript 接口定义 |
| `frontend/src/api/chat.ts` | API 函数 + SSE 流处理 |
| `frontend/src/composables/useSSE.ts` | SSE 解析逻辑 |
| `backend/app/services/chat_service.py` | 核心聊天逻辑 |
| `backend/app/agents/` | Agent 模块（routes/schemas/service/prompts） |
| `backend/app/services/memory_service.py` | AI 记忆提取 |
| `backend/app/services/llm/base.py` | LLM 提供者抽象 |

## 约束

1. 前端使用 `<script setup lang="ts">` 语法
2. 所有聊天消息通过 SSE 流式传输
3. 后端业务逻辑放在 Services 层，不在路由中直接编写
4. Agent 和 Rule 在请求时注入到系统提示词
5. 会话持久化存储在本地文件系统
