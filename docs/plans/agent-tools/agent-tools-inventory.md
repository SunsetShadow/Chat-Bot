# Agent Tools 速查手册

> 本文档整理了项目中所有 Agent Tool 的定义、依赖、环境变量和迁移要点，方便快速复制到其他项目。

---

## 目录

- [1. 工具总览](#1-工具总览)
- [2. 公共依赖与核心包](#2-公共依赖与核心包)
- [3. 环境变量清单](#3-环境变量清单)
- [4. 工具详细说明](#4-工具详细说明)
  - [4.1 联网搜索 (web_search)](#41-联网搜索-web_search)
  - [4.2 发送邮件 (send_mail)](#42-发送邮件-send_mail)
  - [4.3 数据库用户 CRUD (db_users_crud)](#43-数据库用户-crud-db_users_crud)
  - [4.4 定时任务管理 (cron_job)](#44-定时任务管理-cron_job)
  - [4.5 获取当前时间 (time_now)](#45-获取当前时间-time_now)
  - [4.6 读取文件 (read_file)](#46-读取文件-read_file)
  - [4.7 写入文件 (write_file)](#47-写入文件-write_file)
  - [4.8 执行命令 (execute_command)](#48-执行命令-execute_command)
  - [4.9 列出目录 (list_directory)](#49-列出目录-list_directory)
  - [4.10 查询用户 (query_user)](#410-查询用户-query_user)
  - [4.11 库存查询 (get_product_stock)](#411-库存查询-get_product_stock)
  - [4.12 天气查询 (lookup_weather)](#412-天气查询-lookup_weather)
  - [4.13 城市小知识 (lookup_city_trivia)](#413-城市小知识-lookup_city_trivia)
  - [4.14 MCP Server 工具 (query_user via MCP)](#414-mcp-server-工具-query_user-via-mcp)
- [5. 工具注册模式](#5-工具注册模式)
  - [5.1 纯 ESM 模式（.mjs）](#51-纯-esm-模式mjs)
  - [5.2 NestJS Provider 模式（.ts）](#52-nestjs-provider-模式ts)
  - [5.3 NestJS 独立 Service 模式（cron-job-tool）](#53-nestjs-独立-service-模式cron-job-tool)
- [6. Agent 调用模式](#6-agent-调用模式)
  - [6.1 手动循环调用（tool-test）](#61-手动循环调用tool-test)
  - [6.2 LangGraph createAgent（agui-backend）](#62-langgraph-createagentagui-backend)
  - [6.3 LangGraph StateGraph + ToolNode（langgraph-test）](#63-langgraph-stategraph--toolnodelanggraph-test)
  - [6.4 LangGraph Supervisor 多 Agent（langgraph-test）](#64-langgraph-supervisor-多-agentlanggraph-test)
  - [6.5 LangGraph prebuilt createAgent（langgraph-test）](#65-langgraph-prebuilt-createagentlanggraph-test)
  - [6.6 MCP Client 模式（tool-test）](#66-mcp-client-模式tool-test)
  - [6.7 NestJS Agent Service（cron-job-tool）](#67-nestjs-agent-servicecron-job-tool)
- [7. 快速迁移模板](#7-快速迁移模板)
- [8. 各子项目工具使用矩阵](#8-各子项目工具使用矩阵)

---

## 1. 工具总览

| 工具名 | 功能 | 类型 | 所在子项目 | 可复用性 |
|--------|------|------|-----------|---------|
| `web_search` | Bocha 联网搜索 | NestJS/ESM | agui-backend, cron-job-tool | 高 |
| `send_mail` | SMTP 发邮件 | NestJS | agui-backend, cron-job-tool | 高 |
| `db_users_crud` | 用户表 CRUD | NestJS | cron-job-tool | 中（需适配表结构） |
| `cron_job` | 定时任务管理 | NestJS | cron-job-tool | 中（依赖 JobService） |
| `time_now` | 获取服务器时间 | NestJS/ESM | cron-job-tool | 高 |
| `read_file` | 读文件 | ESM | tool-test, output-parser-test | 高 |
| `write_file` | 写文件 | ESM | tool-test, output-parser-test | 高 |
| `execute_command` | 执行系统命令 | ESM | tool-test, output-parser-test | 高 |
| `list_directory` | 列目录 | ESM | tool-test, output-parser-test | 高 |
| `query_user` | 内存用户查询 | NestJS/ESM | agui-backend, tool-test(MCP) | 中 |
| `get_product_stock` | 库存查询（mock） | ESM | langgraph-test | 低（示例） |
| `lookup_weather` | 天气查询（mock） | ESM | langgraph-test | 低（示例） |
| `lookup_city_trivia` | 城市知识（mock） | ESM | langgraph-test | 低（示例） |

---

## 2. 公共依赖与核心包

### 核心 npm 包

| 包名 | 用途 | 版本要求 | 安装命令 |
|------|------|---------|---------|
| `@langchain/core` | Tool 定义、消息类型 | `^1.1.x` | `pnpm add @langchain/core` |
| `@langchain/openai` | OpenAI 兼容模型 | `^1.2.x` | `pnpm add @langchain/openai` |
| `zod` | 参数 Schema 校验 | `^4.x` | `pnpm add zod` |
| `dotenv` | 环境变量加载（ESM 用） | `^17.x` | `pnpm add dotenv` |

### LangGraph 相关包

| 包名 | 用途 | 安装命令 |
|------|------|---------|
| `@langchain/langgraph` | StateGraph、MessagesAnnotation | `pnpm add @langchain/langgraph` |
| `langchain` | `createAgent`、`Tool` | `pnpm add langchain` |
| `@langchain/langgraph-supervisor` | 多 Agent Supervisor | `pnpm add @langchain/langgraph-supervisor` |
| `@langchain/langgraph-checkpoint-sqlite` | SQLite 持久化 | `pnpm add @langchain/langgraph-checkpoint-sqlite` |

### MCP 相关包

| 包名 | 用途 | 安装命令 |
|------|------|---------|
| `@langchain/mcp-adapters` | LangChain MCP 客户端适配 | `pnpm add @langchain/mcp-adapters` |
| `@modelcontextprotocol/sdk` | MCP Server/Client SDK | `pnpm add @modelcontextprotocol/sdk` |

### NestJS 相关包

| 包名 | 用途 | 安装命令 |
|------|------|---------|
| `@nestjs/common` | Injectable、Module 等 | `pnpm add @nestjs/common` |
| `@nestjs/config` | ConfigService 环境变量 | `pnpm add @nestjs/config` |
| `@nestjs-modules/mailer` | 邮件发送 | `pnpm add @nestjs-modules/mailer` |
| `nodemailer` | SMTP 底层库 | `pnpm add nodemailer` |
| `@nestjs/typeorm` | TypeORM 集成 | `pnpm add @nestjs/typeorm` |
| `mysql2` | MySQL 驱动 | `pnpm add mysql2` |
| `typeorm` | ORM | `pnpm add typeorm` |
| `cron` | Cron 表达式解析 | `pnpm add cron` |
| `@nestjs/schedule` | NestJS 定时任务 | `pnpm add @nestjs/schedule` |

### AI SDK（前端流式对接用）

| 包名 | 用途 | 安装命令 |
|------|------|---------|
| `ai` | Vercel AI SDK（UIMessage、流式管道） | `pnpm add ai` |
| `@ai-sdk/langchain` | LangChain ↔ AI SDK 桥接 | `pnpm add @ai-sdk/langchain` |

---

## 3. 环境变量清单

### LLM 基础配置（所有项目都需要）

```env
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
MODEL_NAME=qwen-plus
```

### Bocha 联网搜索

```env
BOCHA_API_KEY=sk-xxx
```

### SMTP 邮件

```env
MAIL_HOST=smtp.qq.com
MAIL_PORT=587
MAIL_SECURE=false
MAIL_USER=xxx@xx.com
MAIL_PASS=xxx
MAIL_FROM="No Reply" <xxx@xx.com>
```

### MCP 扩展（可选）

```env
AMAP_MAPS_API_KEY=xxx          # 高德地图 MCP
ALLOWED_PATHS=/path1,/path2    # 文件系统 MCP
```

### 数据库（cron-job-tool 用）

```env
DB_HOST=localhost
DB_PORT=3306
DB_USERNAME=root
DB_PASSWORD=xxx
DB_DATABASE=cron_job_tool
```

---

## 4. 工具详细说明

### 4.1 联网搜索 (web_search)

**功能**: 调用 Bocha Web Search API 搜索互联网，返回标题、摘要、URL 等。

**依赖**: `@langchain/core`（tool、z）、`zod`

**环境变量**: `BOCHA_API_KEY`

**Schema**:
```typescript
z.object({
  query: z.string().min(1).describe('搜索关键词'),
  count: z.number().int().min(1).max(20).optional().describe('结果数量，默认 10'),
})
```

**核心实现**:
```typescript
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const webSearchTool = tool(
  async ({ query, count }: { query: string; count?: number }) => {
    const apiKey = process.env.BOCHA_API_KEY;
    if (!apiKey) return 'API Key 未配置';

    const response = await fetch('https://api.bochaai.com/v1/web-search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, freshness: 'noLimit', summary: true, count: count ?? 10 }),
    });

    const json = await response.json();
    if (json.code !== 200 || !json.data) return `搜索失败: ${json.msg ?? '未知错误'}`;

    const webpages = json.data.webPages?.value ?? [];
    if (!webpages.length) return '未找到相关结果。';

    return webpages.map((page: any, idx: number) =>
      `引用: ${idx + 1}\n标题: ${page.name}\nURL: ${page.url}\n摘要: ${page.summary}\n网站名称: ${page.siteName}\n发布时间: ${page.dateLastCrawled}`
    ).join('\n\n');
  },
  {
    name: 'web_search',
    description: '使用 Bocha Web Search API 搜索互联网网页。返回标题、URL、摘要等信息。',
    schema: z.object({
      query: z.string().min(1).describe('搜索关键词'),
      count: z.number().int().min(1).max(20).optional().describe('结果数量'),
    }),
  }
);
```

**迁移要点**: 仅需 `BOCHA_API_KEY`，无外部服务依赖，可直接复制。

---

### 4.2 发送邮件 (send_mail)

**功能**: 通过 SMTP 发送邮件。

**依赖**: `@langchain/core`、`zod`、`@nestjs-modules/mailer`（NestJS 环境下）、`nodemailer`

**环境变量**: `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM`

**Schema**:
```typescript
z.object({
  to: z.email().describe('收件人邮箱'),
  subject: z.string().describe('邮件主题'),
  text: z.string().optional().describe('纯文本内容'),
  html: z.string().optional().describe('HTML 内容'),
})
```

**NestJS 模式核心实现**:
```typescript
// 在 NestJS 中使用 @nestjs-modules/mailer
const sendMailTool = tool(
  async ({ to, subject, text, html }: { to: string; subject: string; text?: string; html?: string }) => {
    await mailerService.sendMail({
      to, subject,
      text: text ?? '（无文本内容）',
      html: html ?? `<p>${text ?? '（无 HTML 内容）'}</p>`,
      from: configService.get<string>('MAIL_FROM'),
    });
    return `邮件已发送到 ${to}，主题为「${subject}」`;
  },
  {
    name: 'send_mail',
    description: '发送电子邮件。需要收件人邮箱、主题，可选文本和HTML内容。',
    schema: sendMailArgsSchema,
  }
);
```

**迁移要点**:
- NestJS 项目需配置 `MailerModule.forRootAsync(...)`
- 非 NestJS 项目可直接用 `nodemailer` 创建 transporter

---

### 4.3 数据库用户 CRUD (db_users_crud)

**功能**: 对数据库 users 表执行增删改查。

**依赖**: `@langchain/core`、`zod`、`@nestjs/typeorm`、`typeorm`、`mysql2`

**环境变量**: `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE`

**Schema**:
```typescript
z.object({
  action: z.enum(['create', 'list', 'get', 'update', 'delete']),
  id: z.number().int().positive().optional().describe('用户 ID'),
  name: z.string().min(1).max(50).optional().describe('用户姓名'),
  email: z.email().max(50).optional().describe('用户邮箱'),
})
```

**迁移要点**:
- 需要对应的 TypeORM Entity 和 Service
- action 模式可复用，改表名和字段即可适配其他实体

---

### 4.4 定时任务管理 (cron_job)

**功能**: 管理定时任务（列表/新增/启停），支持 cron 表达式、固定间隔、一次性定时。

**依赖**: `@langchain/core`、`zod`、`cron`、`@nestjs/schedule`、自定义 `JobService`

**环境变量**: 无额外变量（依赖 JobService 内部实现）

**Schema**:
```typescript
z.object({
  action: z.enum(['list', 'add', 'toggle']),
  id: z.string().optional().describe('任务 ID（toggle 时需要）'),
  enabled: z.boolean().optional().describe('是否启用'),
  type: z.enum(['cron', 'every', 'at']).optional().describe('任务类型'),
  instruction: z.string().optional().describe('任务说明/指令'),
  cron: z.string().optional().describe('Cron 表达式'),
  everyMs: z.number().int().positive().optional().describe('固定间隔毫秒'),
  at: z.string().optional().describe('ISO 时间字符串（一次性）'),
})
```

**迁移要点**:
- 强依赖 `JobService`（负责实际的任务调度和管理）
- 注意：JobAgent 执行任务时**不绑定** `cron_job` 工具，防止无限递归创建子任务

---

### 4.5 获取当前时间 (time_now)

**功能**: 返回服务器当前时间的 ISO 字符串和毫秒时间戳。

**依赖**: `@langchain/core`

**环境变量**: 无

**核心实现**:
```typescript
const timeNowTool = tool(
  async () => {
    const now = new Date();
    return { iso: now.toISOString(), timestamp: now.getTime() };
  },
  {
    name: 'time_now',
    description: '获取当前服务器时间，返回 ISO 字符串和毫秒级时间戳。',
  }
);
```

**迁移要点**: 零依赖，可直接复制。

---

### 4.6 读取文件 (read_file)

**功能**: 读取指定路径的文件内容。

**依赖**: `@langchain/core`、`zod`、Node.js `fs/promises`

**核心实现**:
```typescript
import fs from 'node:fs/promises';

const readFileTool = tool(
  async ({ filePath }: { filePath: string }) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      return `文件内容:\n${content}`;
    } catch (error: any) {
      return `读取文件失败: ${error.message}`;
    }
  },
  {
    name: 'read_file',
    description: '读取指定路径的文件内容',
    schema: z.object({ filePath: z.string().describe('文件路径') }),
  }
);
```

**迁移要点**: 纯 Node.js，零外部依赖，可直接复制。

---

### 4.7 写入文件 (write_file)

**功能**: 向指定路径写入文件，自动创建目录。

**依赖**: `@langchain/core`、`zod`、Node.js `fs/promises`、`path`

**核心实现**:
```typescript
import fs from 'node:fs/promises';
import path from 'node:path';

const writeFileTool = tool(
  async ({ filePath, content }: { filePath: string; content: string }) => {
    try {
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, content, 'utf-8');
      return `文件写入成功: ${filePath}`;
    } catch (error: any) {
      return `写入文件失败: ${error.message}`;
    }
  },
  {
    name: 'write_file',
    description: '向指定路径写入文件内容，自动创建目录',
    schema: z.object({
      filePath: z.string().describe('文件路径'),
      content: z.string().describe('要写入的内容'),
    }),
  }
);
```

**迁移要点**: 纯 Node.js，可直接复制。

---

### 4.8 执行命令 (execute_command)

**功能**: 执行系统命令，支持指定工作目录，实时输出。

**依赖**: `@langchain/core`、`zod`、Node.js `child_process`

**核心实现**:
```typescript
import { spawn } from 'node:child_process';

const executeCommandTool = tool(
  async ({ command, workingDirectory }: { command: string; workingDirectory?: string }) => {
    const cwd = workingDirectory || process.cwd();
    return new Promise((resolve) => {
      const child = spawn(command, [], { cwd, stdio: 'inherit', shell: true });
      let errorMsg = '';
      child.on('error', (error) => { errorMsg = error.message; });
      child.on('close', (code) => {
        if (code === 0) resolve(`命令执行成功: ${command}`);
        else resolve(`命令执行失败，退出码: ${code}${errorMsg ? '\n错误: ' + errorMsg : ''}`);
      });
    });
  },
  {
    name: 'execute_command',
    description: '执行系统命令，支持指定工作目录',
    schema: z.object({
      command: z.string().describe('要执行的命令'),
      workingDirectory: z.string().optional().describe('工作目录'),
    }),
  }
);
```

**迁移要点**: 纯 Node.js，注意安全风险（任意命令执行），生产环境需加白名单限制。

---

### 4.9 列出目录 (list_directory)

**功能**: 列出指定目录下的文件和文件夹。

**依赖**: `@langchain/core`、`zod`、Node.js `fs/promises`

**迁移要点**: 零外部依赖，可直接复制。

---

### 4.10 查询用户 (query_user)

**功能**: 根据用户 ID 查询用户信息。

**两种实现**:
- **NestJS 版**（agui-backend）: 查内存 Map 数据
- **MCP Server 版**（tool-test）: 通过 MCP 协议暴露

**NestJS 版核心实现**:
```typescript
const queryUserTool = tool(
  async ({ userId }: { userId: string }) => {
    const user = userService.findOne(userId);
    if (!user) return `用户 ID ${userId} 不存在`;
    return `用户信息：\n- ID: ${user.id}\n- 姓名: ${user.name}\n- 邮箱: ${user.email}\n- 角色: ${user.role}`;
  },
  {
    name: 'query_user',
    description: '查询数据库中的用户信息',
    schema: z.object({ userId: z.string().describe('用户 ID') }),
  }
);
```

**迁移要点**: 需替换为实际的 UserService/数据源。

---

### 4.11 库存查询 (get_product_stock)

**功能**: 按 SKU 查询商品库存（mock 数据）。

**依赖**: `@langchain/core`、`zod`

**所在**: `langgraph-test/src/prebuilt-tool-node.mjs`、`langgraph-test/src/prebuilt-agent.mjs`

**迁移要点**: 纯示例，需替换为实际库存 API。

---

### 4.12 天气查询 (lookup_weather)

**功能**: 查询城市天气（mock 数据）。

**依赖**: `@langchain/core`、`zod`、`langchain`（createAgent）

**所在**: `langgraph-test/src/multi-agent-supervisor.mjs`

**迁移要点**: 纯示例，需替换为实际天气 API（如高德天气）。

---

### 4.13 城市小知识 (lookup_city_trivia)

**功能**: 查询与城市相关的趣味知识（mock 数据）。

**所在**: `langgraph-test/src/multi-agent-supervisor.mjs`

**迁移要点**: 纯示例。

---

### 4.14 MCP Server 工具 (query_user via MCP)

**功能**: 通过 MCP 协议暴露工具，供 Cursor 等 MCP Client 调用。

**依赖**: `@modelcontextprotocol/sdk`、`zod`

**核心实现**:
```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const server = new McpServer({ name: 'my-mcp-server', version: '1.0.0' });

server.registerTool('query_user', {
  description: '查询用户信息',
  inputSchema: { userId: z.string().describe('用户 ID') },
}, async ({ userId }) => {
  // ...查询逻辑
  return { content: [{ type: 'text', text: '结果文本' }] };
});

// 还可注册 Resource（文档等）
server.registerResource('使用指南', 'docs://guide', {
  description: '使用文档',
  mimeType: 'text/plain',
}, async () => ({
  contents: [{ uri: 'docs://guide', mimeType: 'text/plain', text: '文档内容' }],
}));

const transport = new StdioServerTransport();
await server.connect(transport);
```

**客户端连接方式**:
```typescript
import { MultiServerMCPClient } from '@langchain/mcp-adapters';

const mcpClient = new MultiServerMCPClient({
  mcpServers: {
    'my-server': {
      command: 'node',
      args: ['./my-mcp-server.mjs'],
    },
    'remote-server': {
      url: 'https://mcp.example.com/mcp?key=xxx',  // Streamable HTTP
    },
    'filesystem': {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', '/allowed/path'],
    },
  }
});
const tools = await mcpClient.getTools();
```

**迁移要点**:
- MCP Server 可独立运行，支持 stdio 和 HTTP 两种传输
- 客户端通过 `@langchain/mcp-adapters` 的 `MultiServerMCPClient` 统一接入

---

## 5. 工具注册模式

### 5.1 纯 ESM 模式（.mjs）

适用场景：脚本、学习示例、无框架项目。

```javascript
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

const myTool = tool(
  async ({ param }) => { /* 实现 */ },
  {
    name: 'my_tool',
    description: '工具描述',
    schema: z.object({ param: z.string().describe('参数说明') }),
  }
);

// 绑定到模型
const model = new ChatOpenAI({ ... });
const modelWithTools = model.bindTools([myTool]);
```

**项目中的使用**: `tool-test/`、`output-parser-test/`、`langgraph-test/`

---

### 5.2 NestJS Provider 模式（.ts）

适用场景：NestJS 项目，工具直接在 Module 中用 factory 注册。

```typescript
// ai.module.ts
@Module({
  providers: [
    {
      provide: 'MY_TOOL',
      useFactory: (depService: DepService) => {
        return tool(
          async ({ param }) => { /* 使用 depService */ },
          { name: 'my_tool', description: '...', schema: z.object({...}) },
        );
      },
      inject: [DepService],
    },
  ],
  exports: ['MY_TOOL'],
})
export class AiModule {}
```

**项目中的使用**: `agui-backend/src/ai/ai.module.ts`

---

### 5.3 NestJS 独立 Service 模式（cron-job-tool）

适用场景：工具逻辑复杂，需要注入多个依赖。

```typescript
// tool/my-tool.service.ts
@Injectable()
export class MyToolService {
  readonly tool;

  @Inject(DepService)
  private readonly depService: DepService;

  constructor() {
    this.tool = tool(
      async ({ param }) => { /* 使用 this.depService */ },
      { name: 'my_tool', description: '...', schema: z.object({...}) },
    );
  }
}

// tool/tool.module.ts
@Module({
  providers: [
    MyToolService,
    { provide: 'MY_TOOL', useFactory: (svc: MyToolService) => svc.tool, inject: [MyToolService] },
  ],
  exports: ['MY_TOOL'],
})
export class ToolModule {}
```

**项目中的使用**: `cron-job-tool/src/tool/`（推荐模式，职责分离清晰）

---

## 6. Agent 调用模式

### 6.1 手动循环调用（tool-test）

最基础的模式，手动管理消息循环。

```typescript
const modelWithTools = model.bindTools(tools);
const messages = [new SystemMessage('...'), new HumanMessage(query)];

while (true) {
  const response = await modelWithTools.invoke(messages);
  messages.push(response);

  if (!response.tool_calls?.length) {
    console.log(response.content); // 最终回复
    break;
  }

  // 执行工具调用
  for (const toolCall of response.tool_calls) {
    const foundTool = tools.find(t => t.name === toolCall.name);
    if (foundTool) {
      const result = await foundTool.invoke(toolCall.args);
      messages.push(new ToolMessage({ content: result, tool_call_id: toolCall.id }));
    }
  }
}
```

---

### 6.2 LangGraph createAgent（agui-backend）

最简洁的 LangGraph Agent 创建方式，一行搞定。

```typescript
import { createAgent } from 'langchain';

const agent = createAgent({
  model,
  tools: [webSearchTool, sendMailTool],
  systemPrompt: '你是 AI 助手...',
});

// 流式调用
const stream = await agent.stream(
  { messages: lcMessages },
  { streamMode: ['messages', 'values'], recursionLimit: 30 },
);
```

---

### 6.3 LangGraph StateGraph + ToolNode（langgraph-test）

手动构建图，更灵活。

```typescript
import { StateGraph, MessagesAnnotation, END, START } from '@langchain/langgraph';
import { ToolNode, toolsCondition } from '@langchain/langgraph/prebuilt';

const toolNode = new ToolNode(tools);

const graph = new StateGraph(MessagesAnnotation)
  .addNode('agent', async (state) => {
    const response = await modelWithTools.invoke(state.messages);
    return { messages: response };
  })
  .addNode('tools', toolNode)
  .addEdge(START, 'agent')
  .addConditionalEdges('agent', toolsCondition, ['tools', END])
  .addEdge('tools', 'agent')
  .compile();
```

---

### 6.4 LangGraph Supervisor 多 Agent（langgraph-test）

多个子 Agent，由 Supervisor 调度。

```typescript
import { createSupervisor } from '@langchain/langgraph-supervisor';
import { createAgent } from 'langchain';

const weatherAgent = createAgent({
  name: 'weather_agent', description: '查天气',
  model, tools: [weatherTool], systemPrompt: '...',
});
const triviaAgent = createAgent({
  name: 'trivia_agent', description: '城市小知识',
  model, tools: [triviaTool], systemPrompt: '...',
});

const workflow = createSupervisor({
  agents: [weatherAgent.graph, triviaAgent.graph],
  llm: model,
  prompt: '你是调度员，根据问题类型选择子 Agent...',
});
const app = workflow.compile();
```

---

### 6.5 LangGraph prebuilt createAgent（langgraph-test）

带 checkpointer 的 createAgent，支持多轮对话记忆。

```typescript
import { MemorySaver } from '@langchain/langgraph';

const agent = createAgent({
  model,
  tools: [getProductStock],
  systemPrompt: '你是仓库助手...',
  checkpointer: new MemorySaver(),  // 内存持久化
});

const result = await agent.invoke(
  { messages: [new HumanMessage('...')] },
  { configurable: { thread_id: 'demo-thread' } },  // 按 thread 隔离
);
```

---

### 6.6 MCP Client 模式（tool-test）

通过 MCP 协议连接外部工具服务。

```typescript
import { MultiServerMCPClient } from '@langchain/mcp-adapters';

const mcpClient = new MultiServerMCPClient({
  mcpServers: {
    'my-server': { command: 'node', args: ['./server.mjs'] },
    'remote-api': { url: 'https://mcp.example.com/mcp?key=xxx' },
  }
});

const tools = await mcpClient.getTools();  // 自动获取所有 MCP 工具
const modelWithTools = model.bindTools(tools);
// 后续同手动循环调用模式...
```

---

### 6.7 NestJS Agent Service（cron-job-tool）

在 NestJS Service 中封装 Agent 循环逻辑。

```typescript
@Injectable()
export class JobAgentService {
  private readonly modelWithTools: Runnable;

  constructor(
    @Inject('CHAT_MODEL') model: ChatOpenAI,
    @Inject('SEND_MAIL_TOOL') private readonly sendMailTool: any,
    @Inject('WEB_SEARCH_TOOL') private readonly webSearchTool: any,
  ) {
    this.modelWithTools = model.bindTools([sendMailTool, webSearchTool]);
  }

  async runJob(instruction: string): Promise<string> {
    const messages = [new SystemMessage('...'), new HumanMessage(instruction)];

    while (true) {
      const aiMessage = await this.modelWithTools.invoke(messages);
      messages.push(aiMessage);

      const toolCalls = aiMessage.tool_calls ?? [];
      if (!toolCalls.length) return String(aiMessage.content);

      for (const toolCall of toolCalls) {
        // 按工具名分派执行
        const tool = this.getToolByName(toolCall.name);
        const result = await tool.invoke(toolCall.args);
        messages.push(new ToolMessage({ tool_call_id: toolCall.id, content: result }));
      }
    }
  }
}
```

---

## 7. 快速迁移模板

### 最小 ESM 迁移（3 个文件）

```
project/
├── .env                 # 环境变量
├── package.json         # 依赖
└── src/
    ├── tools.mjs        # 工具定义
    └── agent.mjs        # Agent 逻辑
```

**package.json 最小依赖**:
```json
{
  "type": "commonjs",
  "dependencies": {
    "@langchain/core": "^1.1.39",
    "@langchain/openai": "^1.4.4",
    "dotenv": "^17.4.1",
    "zod": "^4.3.6"
  }
}
```

**LangGraph 版追加**:
```json
{
  "@langchain/langgraph": "^1.2.8",
  "langchain": "^1.3.1"
}
```

### 最小 NestJS 迁移

```
project/
├── .env
├── package.json
└── src/
    ├── ai/
    │   ├── ai.module.ts    # 注册 CHAT_MODEL + 工具 Provider
    │   ├── ai.service.ts   # Agent 逻辑
    │   └── ai.controller.ts # HTTP 接口
    └── app.module.ts       # 导入 AiModule
```

---

## 8. 各子项目工具使用矩阵

| 工具 | tool-test | output-parser-test | langgraph-test | cron-job-tool | agui-backend | hello-nest-langchain | asr-and-tts |
|------|:---------:|:------------------:|:--------------:|:------------:|:------------:|:-------------------:|:-----------:|
| read_file | ✅ | ✅ | | | | | |
| write_file | ✅ | ✅ | | | | | |
| execute_command | ✅ | ✅ | | | | | |
| list_directory | ✅ | ✅ | | | | | |
| web_search | | | | ✅ | ✅ | | |
| send_mail | | | | ✅ | ✅ | | |
| db_users_crud | | | | ✅ | | | |
| cron_job | | | | ✅ | | | |
| time_now | | | | ✅ | | | |
| query_user | ✅(MCP) | | | | ✅ | | |
| get_product_stock | | | ✅ | | | | |
| lookup_weather | | | ✅ | | | | |
| lookup_city_trivia | | | ✅ | | | | |
| **Agent 模式** | 手动循环 | 流式解析 | StateGraph / createAgent / Supervisor | NestJS Agent | LangGraph createAgent | Prompt Chain | SSE 流 |
