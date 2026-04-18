# 开发规范

本文档定义项目的开发标准：技术栈、目录结构、命名规范、代码风格、关键文件索引。
功能详细规范见 [core-features/spec.md](../core-features/spec.md)。

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
| AI | @langchain/langgraph + langgraph-supervisor | ^1.2 / ^1.0 |
| AI | @langchain/openai | ^1.x |
| Schema 校验 | zod | ^4.x |
| 邮件 | nodemailer | ^8.x |
| 验证 | class-validator + class-transformer | ^0.14 / ^0.5 |
| 环境变量 | @nestjs/config | ^4.x |
| 代码检查 | ESLint + typescript-eslint | ^9.x / ^8.x |

## 目录结构

```
Chat-Bot/
├── frontend/                    # 前端项目
│   ├── src/
│   │   ├── api/                 # API 调用层
│   │   ├── assets/              # 静态资源
│   │   ├── components/          # Vue 组件
│   │   │   ├── agent/           #   Agent 相关组件
│   │   │   ├── chat/            #   聊天相关组件
│   │   │   ├── common/          #   通用组件（AppHeader、NotificationBell、NotificationToast、ThemeToggle）
│   │   │   ├── cron-job/        #   定时任务组件（JobForm、ExecutionHistory）
│   │   │   └── settings/        #   系统设置组件（SystemSettingsPane、DirectoryBrowser）
│   │   │   └── rules/           #   规则相关组件
│   │   ├── composables/         # Vue Composables
│   │   ├── stores/              # Pinia 状态管理
│   │   ├── types/               # TypeScript 类型定义
│   │   └── utils/               # 工具函数
│   └── package.json
│
├── backend/                     # 后端项目
│   ├── src/
│   │   ├── common/              # 公共层
│   │   │   ├── entities/        #   TypeORM 实体定义
│   │   │   ├── types/           #   公共类型定义
│   │   │   ├── filters/         #   异常过滤器
│   │   │   └── interceptors/    #   拦截器
│   │   ├── config/              # 配置模块
│   │   ├── middleware/          # 中间件
│   │   └── modules/             # 业务模块
│   │       ├── agent/           #   Agent CRUD + 内置定义
│   │       ├── chat/            #   聊天模块（SSE）
│   │       ├── cron-job/        #   定时任务模块（调度 + 执行 + 通知）
│   │       ├── langgraph/       #   LangGraph 工作流
│   │       │   ├── graph/       #     graph.builder.ts + supervisor.builder.ts
│   │       │   └── tools/       #     工具系统
│   │       │       ├── base/    #       tool.helper.ts（safeTool）+ path-sandbox.ts（路径沙箱）
│   │       │       └── collections/ # 按域分组（search/communication/system/file-system/search-files）
│   │       ├── memory/          #   记忆模块（PG + Milvus + Embedding）
│   │       ├── settings/        #   系统设置模块（KV 配置 + 路径沙箱管理）
│   │       ├── model/           #   模型管理
│   │       ├── rule/            #   规则 CRUD
│   │       └── upload/          #   文件上传
│   └── package.json
│
├── docker-compose.yml           # Milvus 容器编排
└── docs/                        # 文档
    ├── specs/                   #   当前系统规范
    ├── plans/                   #   未来演进计划
    ├── references/              #   参考读物
    └── changes/                 #   历史变更记录
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

## 代码风格

| 约束 | 说明 |
|------|------|
| 函数长度 | 不超过 30 行（复杂算法除外） |
| 参数数量 | 不超过 3 个，超过时使用配置对象 |
| 嵌套深度 | 最多 3 层，使用早期返回减少嵌套 |
| 类型注解 | 公共 API 必须有类型注解 |
| Lint 检查 | 所有代码必须通过 ESLint |

## UI 风格

| 约束 | 说明 |
|------|------|
| CSS 框架 | 使用 Tailwind CSS，不写自定义 CSS |
| 组件库 | Naive UI 组件为主，自定义组件为辅 |
| CSS 变量 | 使用 `main.css` 中定义的 CSS 变量 |
| 字体 | Sora（正文）、JetBrains Mono（代码） |

CSS 变量使用 `main.css` 中的定义，不硬编码：
颜色（`--color-primary`、`--bg-primary`、`--text-primary`）、阴影（`--shadow-sm/md/lg`）、圆角（`--radius-sm/md/lg`）、过渡（`--transition-fast/smooth`）。

Naive UI 组件库：[Naive UI](https://naiveui.com/zh-CN/os-theme/components/)

## 关键文件索引

### 前端

| 路径 | 用途 |
|------|------|
| `composables/useAIChat.ts` | AI SDK Chat 实例（单例），sendMessage / stopStreaming / regenerate |
| `composables/useChatTransport.ts` | 自定义 ChatTransport，SSE → UIMessageChunk |
| `stores/chat.ts` | Pinia store，会话列表和当前会话状态 |
| `api/chat.ts` | REST API 调用（会话 CRUD、消息历史） |
| `components/chat/ToolCallBlock.vue` | 工具调用实时显示组件 |
| `api/cron-job.ts` | 定时任务 API 调用层 |
| `components/settings/SystemSettingsPane.vue` | 系统设置面板（路径沙箱配置） |
| `components/settings/DirectoryBrowser.vue` | 目录浏览器（NDrawer 懒加载） |
| `stores/cron-job.ts` | 定时任务 Pinia store |
| `assets/main.css` | CSS 变量和全局样式 |
| `types/index.ts` | TypeScript 接口定义 |

### 后端

| 路径 | 用途 |
|------|------|
| `modules/chat/chat.controller.ts` | 聊天 API 路由（含 SSE、会话 CRUD） |
| `modules/chat/chat.service.ts` | 核心聊天逻辑（含联网搜索意图判断） |
| `modules/langgraph/langgraph.service.ts` | LangGraph 工作流集成（Supervisor + 独立执行器 + 流式输出） |
| `modules/langgraph/langgraph.module.ts` | 模块注册（工具 + Agent 回调 + 图初始化） |
| `modules/langgraph/graph/graph.builder.ts` | 单 Agent 图构建（旧，仍在使用） |
| `modules/langgraph/graph/supervisor.builder.ts` | Supervisor 多 Agent 图构建（含隐藏 Agent 过滤） |
| `modules/langgraph/tools/tool-registry.service.ts` | 工具注册中心（权限 + 分类） |
| `modules/langgraph/tools/tool.loader.ts` | 工具统一加载器 |
| `modules/langgraph/tools/base/tool.helper.ts` | safeTool 错误包装 |
| `modules/langgraph/tools/base/path-sandbox.ts` | 路径沙箱（黑名单 + 白名单校验） |
| `modules/langgraph/tools/collections/search-files.tool.ts` | 文件搜索工具（文件名 glob + 内容 regex） |
| `modules/langgraph/tools/cron-job.tool.ts` | 定时任务工具（add/list/toggle） |
| `modules/cron-job/job.service.ts` | 定时任务调度引擎（CRUD + 运行时 + 重试） |
| `modules/cron-job/job-execution.service.ts` | 任务执行记录（CRUD + 查询） |
| `modules/cron-job/cron-job.controller.ts` | 定时任务 API 路由 |
| `modules/agent/` | Agent 模块（controller/service/dto + 内置同步 + is_system 权限分级） |
| `modules/settings/` | 系统设置模块（KV 配置 + 目录浏览 API） |
| `modules/model/model.service.ts` | 模型列表管理（含 available 可用性标记） |
| `modules/memory/memory.service.ts` | 记忆管理（PG + Milvus 双写） |
| `modules/memory/milvus.service.ts` | Milvus 向量数据库客户端 |
| `config/config.service.ts` | 应用配置服务（环境变量封装） |
| `common/entities/` | TypeORM 实体定义 |

### 基础设施

| 路径 | 用途 |
|------|------|
| `docker-compose.yml` | Milvus 容器编排 |
| `backend/.env.example` | 环境变量模板 |
