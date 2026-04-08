# NestJS 后端重构设计文档

> 日期: 2026-04-01
> 状态: 待审阅
> 范围: 将 FastAPI (Python) 后端完整迁移至 NestJS (TypeScript)

---

## 1. 概述

将现有 Python FastAPI 后端使用 NestJS 11.x + TypeScript 完整重构。保持所有功能不变，API 接口完全兼容前端，同步更新 `openspec/specs/` 规范文档。

### 约束

- 运行时: Node.js + TypeScript
- 包管理: pnpm
- 架构: 单体应用，模块化分层
- 存储: 保持内存存储（与当前行为一致）
- API 路径: 保持 `/api/v1/` 前缀不变

### 成功标准

1. 所有现有 API 端点功能 1:1 还原
2. SSE 流式聊天正常工作
3. 前端无需任何修改即可对接
4. `pnpm dev` 一键启动，`pnpm build` 构建通过

---

## 2. 技术选型

| 类别 | 选型 | 说明 |
|------|------|------|
| 框架 | NestJS 11.x | 最新稳定版 |
| 语言 | TypeScript 5.x | 严格模式 |
| 运行时 | Node.js 20+ | LTS 版本 |
| 包管理 | pnpm | monorepo 友好 |
| LLM SDK | openai (npm) | OpenAI 官方 SDK |
| 验证 | class-validator + class-transformer | NestJS 标准验证方案 |
| 文件上传 | @nestjs/platform-express (内建) | Multer 处理 multipart |
| 环境变量 | @nestjs/config | ConfigModule |
| 代码规范 | ESLint + Prettier | NestJS 内建支持 |

---

## 3. 目录结构

```
backend/
├── src/
│   ├── main.ts                          # 应用入口
│   ├── app.module.ts                    # 根模块
│   │
│   ├── common/                          # 公共层
│   │   ├── types/                       # 公共类型定义
│   │   │   └── index.ts
│   │   ├── filters/                     # 异常过滤器
│   │   │   └── http-exception.filter.ts
│   │   └── interceptors/                # 拦截器
│   │       └── logging.interceptor.ts
│   │
│   ├── config/                          # 配置模块
│   │   ├── config.module.ts
│   │   └── config.service.ts
│   │
│   ├── middleware/                       # 中间件
│   │   ├── security.middleware.ts        # 安全头
│   │   ├── rate-limit.middleware.ts      # 速率限制
│   │   └── input-validation.middleware.ts # 输入验证
│   │
│   └── modules/                         # 业务模块
│       ├── chat/                        # 聊天模块
│       │   ├── chat.module.ts
│       │   ├── chat.controller.ts
│       │   ├── chat.service.ts
│       │   ├── chat.gateway.ts          # SSE 流式处理
│       │   └── dto/
│       │       ├── create-completion.dto.ts
│       │       ├── create-session.dto.ts
│       │       └── update-session.dto.ts
│       │
│       ├── agent/                       # Agent 模块
│       │   ├── agent.module.ts
│       │   ├── agent.controller.ts
│       │   ├── agent.service.ts
│       │   └── dto/
│       │       ├── create-agent.dto.ts
│       │       └── update-agent.dto.ts
│       │
│       ├── rule/                        # 规则模块
│       │   ├── rule.module.ts
│       │   ├── rule.controller.ts
│       │   ├── rule.service.ts
│       │   └── dto/
│       │       ├── create-rule.dto.ts
│       │       └── update-rule.dto.ts
│       │
│       ├── memory/                      # 记忆模块
│       │   ├── memory.module.ts
│       │   ├── memory.controller.ts
│       │   ├── memory.service.ts
│       │   └── dto/
│       │       ├── create-memory.dto.ts
│       │       └── update-memory.dto.ts
│       │
│       ├── upload/                      # 上传模块
│       │   ├── upload.module.ts
│       │   ├── upload.controller.ts
│       │   └── upload.service.ts
│       │
│       ├── model/                       # 模型管理模块
│       │   ├── model.module.ts
│       │   ├── model.controller.ts
│       │   └── model.service.ts
│       │
│       └── llm/                         # LLM 集成模块
│           ├── llm.module.ts
│           ├── llm.service.ts           # 统一 LLM 接口
│           └── providers/
│               ├── base.provider.ts     # 抽象基类
│               └── openai.provider.ts   # OpenAI 实现
│
├── uploads/                             # 文件存储目录
├── test/                                # 测试目录
│   ├── chat.e2e-spec.ts
│   ├── agent.e2e-spec.ts
│   └── ...
├── nest-cli.json
├── tsconfig.json
├── tsconfig.build.json
├── .env
├── .env.example
├── package.json
└── pnpm-lock.yaml
```

---

## 4. API 端点映射

所有端点保持与现有 FastAPI 版本完全一致，确保前端无需修改。

### 4.1 聊天 `/api/v1/chat`

| 方法 | 端点 | Controller 方法 | 说明 |
|------|------|-----------------|------|
| POST | `/completions` | `createCompletion()` | SSE 流式聊天 |
| POST | `/sessions` | `createSession()` | 创建会话 |
| GET | `/sessions` | `getSessions()` | 会话列表 |
| GET | `/sessions/:id` | `getSession()` | 会话详情 |
| PUT | `/sessions/:id/pin` | `togglePin()` | 置顶切换 |
| GET | `/sessions/:id/messages` | `getMessages()` | 消息列表 |

### 4.2 Agent `/api/v1/agents`

| 方法 | 端点 | Controller 方法 | 说明 |
|------|------|-----------------|------|
| GET | `/` | `findAll()` | 所有 Agent |
| GET | `/:id` | `findOne()` | Agent 详情 |
| POST | `/` | `create()` | 创建 Agent |
| PUT | `/:id` | `update()` | 更新 Agent |
| DELETE | `/:id` | `remove()` | 删除 Agent |

### 4.3 规则 `/api/v1/rules`

| 方法 | 端点 | Controller 方法 | 说明 |
|------|------|-----------------|------|
| GET | `/` | `findAll()` | 所有规则 |
| GET | `/:id` | `findOne()` | 规则详情 |
| POST | `/` | `create()` | 创建规则 |
| PUT | `/:id` | `update()` | 更新规则 |
| DELETE | `/:id` | `remove()` | 删除规则 |

### 4.4 记忆 `/api/v1/memories`

| 方法 | 端点 | Controller 方法 | 说明 |
|------|------|-----------------|------|
| GET | `/` | `findAll()` | 记忆列表 |
| GET | `/:id` | `findOne()` | 记忆详情 |
| POST | `/` | `create()` | 创建记忆 |
| PUT | `/:id` | `update()` | 更新记忆 |
| DELETE | `/:id` | `remove()` | 删除记忆 |

### 4.5 上传 `/api/v1/upload`

| 方法 | 端点 | Controller 方法 | 说明 |
|------|------|-----------------|------|
| POST | `/` | `upload()` | 上传文件 |
| GET | `/:id` | `getFile()` | 获取文件 |
| DELETE | `/:id` | `remove()` | 删除文件 |

### 4.6 模型 `/api/v1/models`

| 方法 | 端点 | Controller 方法 | 说明 |
|------|------|-----------------|------|
| GET | `/` | `findAll()` | 可用模型列表 |

---

## 5. 核心模块设计

### 5.1 LLM 模块

```typescript
// llm/providers/base.provider.ts - 抽象基类
abstract class BaseLLMProvider {
  abstract chat(messages: ChatMessage[]): Promise<string>;
  abstract chatStream(messages: ChatMessage[]): AsyncGenerator<string>;
}

// llm/providers/openai.provider.ts - OpenAI 实现
@Injectable()
class OpenAIProvider extends BaseLLMProvider {
  // 使用 openai npm SDK
  // 支持流式响应 (stream: true)
}

// llm/llm.service.ts - 统一入口
@Injectable()
class LlmService {
  getProvider(): BaseLLMProvider;  // 根据配置返回对应 provider
  chat(messages): Promise<string>;
  chatStream(messages): AsyncGenerator<string>;
}
```

**配置项** (`.env`):
```
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o
```

### 5.2 聊天模块 + SSE

SSE 是核心功能，使用 NestJS 原生 `Observable` + `Sse` 装饰器实现：

```typescript
// chat.controller.ts
@Sse('completions')
createCompletion(@Body() dto: CreateCompletionDto): Observable<MessageEvent> {
  return new Observable((subscriber) => {
    // 流式推送 SSE 事件
    // message_start → content_delta* → message_done → done
  });
}
```

**SSE 事件类型**:
```typescript
interface SSEEvent {
  event: 'message_start' | 'content_delta' | 'message_done' | 'done' | 'error';
  data: string;  // JSON payload
}
```

### 5.3 Agent 模块

```typescript
// agent.service.ts - 内存存储
@Injectable()
class AgentService {
  private agents: Map<string, Agent>;

  onModuleInit() {
    // 初始化内置 Agent: general, writer, programmer
  }

  findAll(): Agent[];
  findOne(id: string): Agent;
  create(dto: CreateAgentDto): Agent;
  update(id: string, dto: UpdateAgentDto): Agent;
  remove(id: string): void;
}
```

**内置 Agent**: 通用助手、写作助手、编程专家（与 Python 版一致）

### 5.4 规则模块

```typescript
// rule.service.ts - 内存存储
@Injectable()
class RuleService {
  private rules: Map<string, Rule>;

  onModuleInit() {
    // 初始化内置规则
  }
  // CRUD + 按优先级排序 + 按启用状态过滤
}
```

### 5.5 记忆模块

```typescript
// memory.service.ts - 内存存储
@Injectable()
class MemoryService {
  private memories: Map<string, Memory>;
  // CRUD + 按重要性排序 + 按类型过滤
}
```

### 5.6 上传模块

```typescript
// upload.controller.ts
@Post()
@UseInterceptors(FileInterceptor('file'))
async upload(@UploadedFile() file: Express.Multer.File) {
  // 文件保存到 uploads/ 目录
  // 限制: 10MB, 图片/文档类型
}
```

### 5.7 模型管理模块

```typescript
// model.service.ts
@Injectable()
class ModelService {
  findAll(): ModelInfo[] {
    // 返回可用 LLM 模型列表
    // OpenAI / Anthropic / Google 模型
  }
}
```

---

## 6. 中间件设计

### 6.1 安全中间件

```typescript
@Injectable()
class SecurityMiddleware implements NestMiddleware {
  use(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Content-Security-Policy', "default-src 'self'");
    next();
  }
}
```

### 6.2 速率限制

```typescript
@Injectable()
class RateLimitMiddleware implements NestMiddleware {
  // 基于 IP 的滑动窗口算法
  // 聊天 API: 20次/分钟
  // Agent API: 30次/分钟
  // 记忆 API: 60次/分钟
}
```

### 6.3 输入验证

```typescript
// 使用 class-validator 装饰器 + 全局 ValidationPipe
@InputLength(1, 10000)
@IsNotEmpty()
content: string;

// 敏感信息检测和 Prompt 注入检测通过自定义 Pipe 实现
```

---

## 7. 依赖清单

```json
{
  "dependencies": {
    "@nestjs/common": "^11.x",
    "@nestjs/core": "^11.x",
    "@nestjs/platform-express": "^11.x",
    "@nestjs/config": "^4.x",
    "class-validator": "^0.14.x",
    "class-transformer": "^0.5.x",
    "openai": "^4.x",
    "multer": "^1.x",
    "uuid": "^11.x",
    "rxjs": "^7.x"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.x",
    "@nestjs/testing": "^11.x",
    "@types/express": "^5.x",
    "@types/multer": "^1.x",
    "@types/uuid": "^10.x",
    "typescript": "^5.x",
    "ts-node": "^10.x",
    "eslint": "^9.x",
    "prettier": "^3.x",
    "jest": "^29.x",
    "@nestjs/config": "^4.x",
    "ts-jest": "^29.x",
    "supertest": "^7.x"
  }
}
```

---

## 8. 环境配置

```env
# .env.example
LLM_PROVIDER=openai
OPENAI_API_KEY=your-api-key
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_MODEL=gpt-4o
PORT=8000
```

---

## 9. 开发命令

```bash
cd backend && pnpm install       # 安装依赖
cd backend && pnpm dev           # 开发模式 (watch)
cd backend && pnpm build         # 构建
cd backend && pnpm start:prod    # 生产模式
cd backend && pnpm test          # 单元测试
cd backend && pnpm test:e2e      # E2E 测试
cd backend && pnpm lint          # ESLint 检查
```

---

## 10. openspec/specs/ 更新范围

需要更新以下规范文档中与后端相关的内容：

### 10.1 `development/spec.md`

| 项 | 现有 | 更新为 |
|----|------|--------|
| 后端技术栈 | FastAPI + Python 3.12+ | NestJS 11.x + TypeScript 5.x |
| 包管理 | uv | pnpm |
| 目录结构 | Python 风格 | NestJS 模块化风格 |
| 命名规范 | snake_case | camelCase |
| 启动命令 | `uv run fastapi dev` | `pnpm dev` |
| 代码风格 | 函数不超30行 | 保持一致 |
| 依赖配置 | pyproject.toml | package.json |

### 10.2 `core-features/spec.md`

| 项 | 变更 |
|----|------|
| SSE 实现 | FastAPI StreamingResponse → NestJS @Sse 装饰器 + Observable |
| 数据验证 | Pydantic → class-validator |
| 配置管理 | pydantic-settings → @nestjs/config |
| API 文档 | FastAPI 自动生成 → Swagger (@nestjs/swagger) |

### 10.3 `security/spec.md`

| 项 | 变更 |
|----|------|
| 输入验证 | Pydantic 验证 → class-validator + 自定义 Pipe |
| 速率限制 | 手动实现 → NestJS Middleware |
| 安全头 | 手动中间件 → NestJS Middleware |

### 10.4 `message-rendering/spec.md`

无变更，此规范只涉及前端渲染。

---

## 11. 风险点

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| SSE 兼容性 | 前端无法接收流式消息 | 使用 NestJS 原生 @Sse 装饰器，与浏览器 EventSource 兼容 |
| API 路径不一致 | 前端请求 404 | 保持 `/api/v1/` 前缀，逐端点验证 |
| CORS 配置 | 前端跨域被拒 | 在 main.ts 中配置 CORS |
| 内置 Agent/规则提示词迁移 | 内容丢失 | 直接复制 Python 版本提示词文本 |
| openai SDK 差异 | 流式响应格式不同 | 使用 openai npm SDK v4 的 stream API |
