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
| AI SDK | ai + @ai-sdk/vue | ^6.0 / ^3.0 |
| Markdown 渲染 | marked + highlight.js | ^17.0 / ^11.11 |
| 代码检查 | ESLint | ^10.1 |
| 包管理 | pnpm | ^10.26.2 |

### 后端

| 类别 | 技术 | 版本 |
|------|------|------|
| 框架 | NestJS | ^11.x |
| 语言 | TypeScript | ^5.x |
| 运行时 | Node.js | 20+ |
| 包管理 | pnpm | ^10.x |
| ORM | TypeORM + @nestjs/typeorm | ^0.3 / ^11.x |
| 数据库 | PostgreSQL | 16 |
| 向量数据库 | Milvus + @zilliz/milvus2-sdk-node | v2.4 / ^2.6 |
| AI | OpenAI SDK (npm) | ^4.x |
| AI | @langchain/openai | ^1.x |
| 验证 | class-validator + class-transformer | ^0.14 / ^0.5 |
| 环境变量 | @nestjs/config | ^4.x |

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
│   ├── src/
│   │   ├── common/              # 公共层
│   │   │   ├── entities/        # TypeORM 实体定义
│   │   │   ├── types/           # 公共类型定义
│   │   │   ├── filters/         # 异常过滤器
│   │   │   └── interceptors/    # 拦截器
│   │   ├── config/              # 配置模块
│   │   ├── middleware/          # 中间件
│   │   └── modules/             # 业务模块
│   │       ├── agent/           # Agent 模块
│   │       ├── chat/            # 聊天模块（含 SSE）
│   │       ├── llm/             # LLM 集成模块
│   │       ├── memory/          # 记忆模块（含 Milvus + Embedding）
│   │       ├── model/           # 模型管理模块
│   │       ├── rule/            # 规则模块
│   │       └── upload/          # 上传模块
│   └── package.json
│
├── docker-compose.yml           # Milvus 容器编排
│
└── docs/                        # 文档
    ├── specs/                   # 当前系统规范
    ├── plans/                   # 未来演进计划
    ├── references/              # 参考读物
    └── changes/                 # 历史变更记录
```

## 命名规范

### 前端

| 类型 | 规范 | 示例 |
|------|------|------|
| 组件文件 | PascalCase | `ChatView.vue`、`MessageItem.vue` |
| Composables | camelCase，以 use 开头 | `useAIChat.ts`、`useChatTransport.ts` |
| Store 文件 | camelCase | `chat.ts`、`agent.ts` |
| 类型定义 | 统一在 `src/types/index.ts` | - |

### 后端

| 类型 | 规范 | 示例 |
|------|------|------|
| 文件 | kebab-case | `chat.service.ts` |
| 类 | PascalCase | `ChatService` |
| 函数/变量 | camelCase | `getChatMessages` |
| 模块目录 | kebab-case | `modules/chat/` |

## 分层架构

```
Controllers (modules/*/controller.ts)
    ↓ 调用
Services (modules/*/service.ts)
    ↓ 调用
TypeORM Repository (结构化数据) / Milvus Service (向量数据)
    ↓ 调用
Providers (modules/llm/providers/)
    ↓ 操作
Entities (common/entities/) / DTOs (modules/*/dto/)
```

## 代码风格约束

| 约束 | 说明 |
|------|------|
| 函数长度 | 不超过 30 行（复杂算法除外） |
| 参数数量 | 不超过 3 个，超过时使用配置对象 |
| 嵌套深度 | 最多 3 层，使用早期返回减少嵌套 |
| 类型注解 | 公共 API 必须有类型注解 |
| Lint 检查 | 所有代码必须通过 ESLint |

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

## 关键文件

| 路径 | 用途 |
|------|------|
| `frontend/src/assets/main.css` | CSS 变量和全局样式 |
| `frontend/src/types/index.ts` | 所有 TypeScript 接口定义 |
| `frontend/src/composables/useAIChat.ts` | AI SDK Chat 实例管理（单例） |
| `frontend/src/composables/useChatTransport.ts` | 自定义 ChatTransport（SSE → UIMessageChunk） |
| `frontend/src/stores/chat.ts` | Pinia 聊天状态管理 |
| `frontend/src/api/chat.ts` | REST API 调用（会话管理等） |
| `backend/src/modules/chat/chat.service.ts` | 核心聊天逻辑 |
| `backend/src/modules/chat/chat.controller.ts` | 聊天 API 路由（含 SSE） |
| `backend/src/modules/langgraph/langgraph.service.ts` | LangGraph 工作流集成 |
| `backend/src/modules/agent/` | Agent 模块（controller/service/dto） |
| `backend/src/modules/memory/memory.service.ts` | 记忆管理（PG + Milvus 双写） |
| `backend/src/modules/memory/embedding.service.ts` | Embedding 生成（@langchain/openai） |
| `backend/src/modules/memory/milvus.service.ts` | Milvus 向量数据库客户端 |
| `backend/src/common/entities/` | TypeORM 实体定义 |
| `docker-compose.yml` | Milvus 容器编排 |

## 约束

1. 前端使用 `<script setup lang="ts">` 语法
2. 所有聊天消息通过 SSE 流式传输
3. 后端使用 NestJS 模块化架构，业务逻辑在 Service 层
4. Agent 和 Rule 在请求时注入到系统提示词
5. 始终考虑组件的可复用性
6. 遵循 Vue 3 最佳实践
7. 确保类型安全
8. 结构化数据通过 TypeORM Repository 操作，Memory embedding 通过 Milvus 操作
9. 内置数据（Agent/Rule）在应用启动时通过 `onModuleInit` 自动 seed
