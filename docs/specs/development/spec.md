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
| AI | OpenAI SDK (npm) | ^4.x |
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
│   │   │   ├── types/           # 公共类型定义
│   │   │   ├── filters/         # 异常过滤器
│   │   │   └── interceptors/    # 拦截器
│   │   ├── config/              # 配置模块
│   │   ├── middleware/          # 中间件
│   │   └── modules/             # 业务模块
│   │       ├── agent/           # Agent 模块
│   │       ├── chat/            # 聊天模块（含 SSE）
│   │       ├── llm/             # LLM 集成模块
│   │       ├── memory/          # 记忆模块
│   │       ├── model/           # 模型管理模块
│   │       ├── rule/            # 规则模块
│   │       └── upload/          # 上传模块
│   └── package.json
│
└── docs/                        # 规范文档
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

## API开发规则

### 接口设计规则
1. 遵循RESTful设计原则
2. 使用HTTP状态码表示结果
3. 响应格式统一为JSON
4. 支持分页的接口必须包含元数据

### 错误处理规则
1. 统一的错误响应格式
2. 错误信息要对用户友好
3. 记录详细的错误日志
4. 敏感信息不能暴露给客户端

### 安全规则
1. 所有接口都要有认证检查
2. 使用HTTPS传输敏感数据
3. 输入数据必须验证和清理
4. 实施适当的限流策略

## 分层架构

```
Controllers (modules/*/controller.ts)
    ↓ 调用
Services (modules/*/service.ts)
    ↓ 调用
Providers (modules/llm/providers/)
    ↓ 操作
Models/DTOs (modules/*/dto/)
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
| `frontend/src/composables/useAIChat.ts` | AI SDK Chat 实例管理（单例） |
| `frontend/src/composables/useChatTransport.ts` | 自定义 ChatTransport（SSE → UIMessageChunk） |
| `frontend/src/stores/chat.ts` | Pinia 聊天状态管理 |
| `frontend/src/api/chat.ts` | REST API 调用（会话管理等） |
| `backend/src/modules/chat/chat.service.ts` | 核心聊天逻辑 |
| `backend/src/modules/chat/chat.controller.ts` | 聊天 API 路由（含 SSE） |
| `backend/src/modules/langgraph/langgraph.service.ts` | LangGraph 工作流集成 |
| `backend/src/modules/agent/` | Agent 模块（controller/service/dto） |
| `backend/src/modules/memory/memory.service.ts` | 记忆管理 |

## 约束

1. 前端使用 `<script setup lang="ts">` 语法
2. 所有聊天消息通过 SSE 流式传输
3. 后端使用 NestJS 模块化架构，业务逻辑在 Service 层
4. Agent 和 Rule 在请求时注入到系统提示词
5. 始终考虑组件的可复用性
7. 遵循Vue3最佳实践
3. 确保类型安全
