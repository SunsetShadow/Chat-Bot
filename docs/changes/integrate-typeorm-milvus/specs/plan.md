# TypeORM + Milvus 集成实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将所有内存数据存储迁移到 PostgreSQL（TypeORM）+ Milvus（Memory embedding 向量）

**Architecture:** TypeORM 管理 5 个结构化实体（Session、Message、Agent、Rule、Memory），Milvus 仅存储 Memory 的 embedding 向量通过 id 关联。Embedding 使用 `@langchain/openai` 的 OpenAIEmbeddings，模型名从 `.env` 读取。Docker Compose 统一管理 PG + Milvus。

**Tech Stack:** TypeORM, PostgreSQL 16, Milvus v2.4, @zilliz/milvus2-sdk-node, @langchain/openai, Docker Compose

---

## File Structure

| 操作 | 文件 | 职责 |
|------|------|------|
| 新增 | `docker-compose.yml` | PG + Milvus 容器编排 |
| 新增 | `backend/src/common/entities/agent.entity.ts` | Agent TypeORM 实体 |
| 新增 | `backend/src/common/entities/rule.entity.ts` | Rule TypeORM 实体 |
| 新增 | `backend/src/common/entities/session.entity.ts` | Session TypeORM 实体 |
| 新增 | `backend/src/common/entities/message.entity.ts` | Message TypeORM 实体 |
| 新增 | `backend/src/common/entities/memory.entity.ts` | Memory TypeORM 实体 |
| 新增 | `backend/src/modules/memory/embedding.service.ts` | Embedding 生成服务 |
| 新增 | `backend/src/modules/memory/milvus.service.ts` | Milvus 客户端封装 |
| 修改 | `backend/.env` | 新增 DB / Milvus / Embedding 配置 |
| 修改 | `backend/src/app.module.ts` | 注册 TypeORM.forRootAsync |
| 修改 | `backend/src/modules/agent/agent.module.ts` | 注册 Entity |
| 修改 | `backend/src/modules/agent/agent.service.ts` | Map → Repository |
| 修改 | `backend/src/modules/rule/rule.module.ts` | 注册 Entity |
| 修改 | `backend/src/modules/rule/rule.service.ts` | Map → Repository |
| 修改 | `backend/src/modules/chat/chat.module.ts` | 注册 Entity |
| 修改 | `backend/src/modules/chat/chat.service.ts` | Map → Repository |
| 修改 | `backend/src/modules/memory/memory.module.ts` | 注册 Entity + Milvus + Embedding |
| 修改 | `backend/src/modules/memory/memory.service.ts` | Map → Repository + Milvus |
| 修改 | `backend/package.json` | 新增依赖（自动更新） |

---

### Task 1: Docker Compose + 依赖安装 + .env 配置

**Files:**
- Create: `docker-compose.yml`
- Modify: `backend/.env`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: 创建 docker-compose.yml**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: chatbot
      POSTGRES_USER: chatbot
      POSTGRES_PASSWORD: chatbot
    ports:
      - "5432:5432"
    volumes:
      - pg_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U chatbot"]
      interval: 5s
      timeout: 5s
      retries: 5

  milvus:
    image: milvusdb/milvus:v2.4-latest
    environment:
      ETCD_USE_EMBED: "true"
      COMMON_STORAGETYPE: local
    ports:
      - "19530:19530"
    volumes:
      - milvus_data:/var/lib/milvus
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9091/healthz"]
      interval: 10s
      timeout: 10s
      retries: 10

volumes:
  pg_data:
  milvus_data:
```

- [ ] **Step 2: 安装后端依赖**

Run: `cd /vol2/1000/机械硬盘1/Linux/workspace/Chat-Bot/backend && pnpm add @nestjs/typeorm typeorm pg @zilliz/milvus2-sdk-node && pnpm add -D @types/pg`

- [ ] **Step 3: 更新 .env 配置**

在 `backend/.env` 末尾追加：

```bash
# PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=chatbot
DB_PASSWORD=chatbot
DB_DATABASE=chatbot

# Milvus
MILVUS_ADDRESS=localhost:19530

# Embedding
EMBEDDINGS_MODEL_NAME=text-embedding-v3
EMBEDDINGS_DIMENSION=1536
```

注意：`EMBEDDINGS_MODEL_NAME` 已存在于 .env（值为 `text-embedding-v3`），不需要重复添加。只追加缺失的配置项。

- [ ] **Step 4: 注册 TypeORM 到 AppModule**

替换 `backend/src/app.module.ts` 为：

```typescript
import { Module, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecurityMiddleware } from './middleware/security.middleware';
import { AppController } from './app.controller';
import { ModelService } from './modules/model/model.service';
import { ChatModule } from './modules/chat/chat.module';
import { AgentModule } from './modules/agent/agent.module';
import { RuleModule } from './modules/rule/rule.module';
import { MemoryModule } from './modules/memory/memory.module';
import { UploadModule } from './modules/upload/upload.module';
import { ModelModule } from './modules/model/model.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get<number>('DB_PORT', 5432),
        username: configService.get('DB_USERNAME', 'chatbot'),
        password: configService.get('DB_PASSWORD', 'chatbot'),
        database: configService.get('DB_DATABASE', 'chatbot'),
        autoLoadEntities: true,
        synchronize: true,
      }),
      inject: [ConfigService],
    }),
    ChatModule,
    AgentModule,
    RuleModule,
    MemoryModule,
    UploadModule,
    ModelModule,
  ],
  controllers: [AppController],
  providers: [ModelService],
})
export class AppModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(SecurityMiddleware).forRoutes('*');
  }
}
```

- [ ] **Step 5: 启动 Docker 容器验证**

Run: `cd /vol2/1000/机械硬盘1/Linux/workspace/Chat-Bot && docker compose up -d`

等待健康检查通过后验证：`docker compose ps`，确认 postgres 和 milvus 状态为 healthy。

---

### Task 2: 创建 5 个 TypeORM Entity

**Files:**
- Create: `backend/src/common/entities/agent.entity.ts`
- Create: `backend/src/common/entities/rule.entity.ts`
- Create: `backend/src/common/entities/session.entity.ts`
- Create: `backend/src/common/entities/message.entity.ts`
- Create: `backend/src/common/entities/memory.entity.ts`

- [ ] **Step 1: 创建 AgentEntity**

创建 `backend/src/common/entities/agent.entity.ts`：

```typescript
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';

@Entity('agents')
export class AgentEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column('text')
  system_prompt: string;

  @Column('simple-array')
  traits: string[];

  @Column({ default: false })
  is_builtin: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany('SessionEntity', 'agent')
  sessions: any[];
}
```

- [ ] **Step 2: 创建 RuleEntity**

创建 `backend/src/common/entities/rule.entity.ts`：

```typescript
import { Entity, PrimaryColumn, Column } from 'typeorm';

export enum RuleCategory {
  BEHAVIOR = 'behavior',
  FORMAT = 'format',
  CONSTRAINT = 'constraint',
}

export enum ConflictStrategy {
  OVERRIDE = 'override',
  MERGE = 'merge',
  REJECT = 'reject',
}

@Entity('rules')
export class RuleEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column('text')
  content: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: 'enum', enum: RuleCategory })
  category: RuleCategory;

  @Column('int')
  priority: number;

  @Column({ type: 'enum', enum: ConflictStrategy })
  conflict_strategy: ConflictStrategy;

  @Column({ default: false })
  is_builtin: boolean;
}
```

- [ ] **Step 3: 创建 SessionEntity**

创建 `backend/src/common/entities/session.entity.ts`：

```typescript
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';

@Entity('sessions')
export class SessionEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ default: false })
  is_pinned: boolean;

  @Column({ nullable: true })
  agent_id: string;

  @Column('simple-json', { nullable: true })
  rule_ids: string[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany('MessageEntity', 'session')
  messages: any[];

  @ManyToOne('AgentEntity', 'sessions')
  @JoinColumn({ name: 'agent_id' })
  agent: any;
}
```

- [ ] **Step 4: 创建 MessageEntity**

创建 `backend/src/common/entities/message.entity.ts`：

```typescript
import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

export type MessageRole = 'user' | 'assistant' | 'system';

@Entity('messages')
export class MessageEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ['user', 'assistant', 'system'] })
  role: MessageRole;

  @Column('text')
  content: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne('SessionEntity', 'messages')
  @JoinColumn({ name: 'session_id' })
  session: any;
}
```

- [ ] **Step 5: 创建 MemoryEntity**

创建 `backend/src/common/entities/memory.entity.ts`：

```typescript
import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

export enum MemoryType {
  FACT = 'fact',
  PREFERENCE = 'preference',
  EVENT = 'event',
}

@Entity('memories')
export class MemoryEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column('text')
  content: string;

  @Column({ type: 'enum', enum: MemoryType })
  type: MemoryType;

  @Column({ nullable: true })
  source_session_id: string;

  @Column('float')
  importance: number;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'timestamp' })
  last_accessed: Date;
}
```

---

### Task 3: AgentService 改造

**Files:**
- Modify: `backend/src/modules/agent/agent.module.ts`
- Modify: `backend/src/modules/agent/agent.service.ts`

- [ ] **Step 1: 更新 AgentModule 注册 Entity**

替换 `backend/src/modules/agent/agent.module.ts` 为：

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentEntity } from '../../common/entities/agent.entity';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';

@Module({
  imports: [TypeOrmModule.forFeature([AgentEntity])],
  controllers: [AgentController],
  providers: [AgentService],
  exports: [AgentService],
})
export class AgentModule {}
```

- [ ] **Step 2: 改造 AgentService**

替换 `backend/src/modules/agent/agent.service.ts` 为：

```typescript
import { Injectable, OnModuleInit, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentEntity } from '../../common/entities/agent.entity';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';

const BUILTIN_AGENTS: Partial<AgentEntity>[] = [
  {
    id: 'builtin-general',
    name: '通用助手',
    description: '默认的 AI 助手，可以回答各类问题',
    system_prompt: '你是一个友好、专业的 AI 助手。请用简洁、准确的语言回答用户的问题。',
    traits: ['友好', '专业', '简洁'],
    is_builtin: true,
  },
  {
    id: 'builtin-programmer',
    name: '编程专家',
    description: '专业的编程问题解答，精通多种编程语言和框架',
    system_prompt: '你是一个资深的编程专家。请提供规范的代码、最佳实践和清晰的解释。代码需要包含必要的注释。',
    traits: ['专业', '代码规范', '最佳实践'],
    is_builtin: true,
  },
  {
    id: 'builtin-writer',
    name: '写作助手',
    description: '文案、创意写作支持，擅长各种文体',
    system_prompt: '你是一个专业的写作助手。请用优美的语言、清晰的结构来帮助用户完成各类写作任务。',
    traits: ['文采', '创意', '结构清晰'],
    is_builtin: true,
  },
];

@Injectable()
export class AgentService implements OnModuleInit {
  constructor(
    @InjectRepository(AgentEntity)
    private agentRepo: Repository<AgentEntity>,
  ) {}

  async onModuleInit() {
    for (const agent of BUILTIN_AGENTS) {
      const exists = await this.agentRepo.existsBy({ id: agent.id });
      if (!exists) {
        await this.agentRepo.save(this.agentRepo.create(agent));
      }
    }
  }

  async findAll(): Promise<AgentEntity[]> {
    return this.agentRepo.find();
  }

  async findOne(id: string): Promise<AgentEntity> {
    const agent = await this.agentRepo.findOneBy({ id });
    if (!agent) {
      throw new NotFoundException(`Agent ${id} not found`);
    }
    return agent;
  }

  async create(dto: CreateAgentDto): Promise<AgentEntity> {
    const agent = this.agentRepo.create({
      name: dto.name,
      description: dto.description || '',
      system_prompt: dto.system_prompt || '',
      traits: dto.traits || [],
      is_builtin: false,
    });
    return this.agentRepo.save(agent);
  }

  async update(id: string, dto: UpdateAgentDto): Promise<AgentEntity> {
    const agent = await this.findOne(id);
    if (agent.is_builtin) {
      throw new BadRequestException('Cannot modify built-in agents');
    }
    Object.assign(agent, dto);
    return this.agentRepo.save(agent);
  }

  async remove(id: string): Promise<void> {
    const agent = await this.findOne(id);
    if (agent.is_builtin) {
      throw new BadRequestException('Cannot delete built-in agents');
    }
    await this.agentRepo.delete(id);
  }
}
```

注意：所有方法变为 `async`。Controller 层已有的 `async/await` 不需要改（原本就用了 await 调用同步方法）。

- [ ] **Step 3: 更新 AgentController（如果方法调用不是 await）**

检查 `backend/src/modules/agent/agent.controller.ts`，确保所有调用 AgentService 方法的地方使用 `await`。原来 Service 方法返回值就是同步的，Controller 一般已经用了 await，但需确认。

---

### Task 4: RuleService 改造

**Files:**
- Modify: `backend/src/modules/rule/rule.module.ts`
- Modify: `backend/src/modules/rule/rule.service.ts`

- [ ] **Step 1: 更新 RuleModule 注册 Entity**

替换 `backend/src/modules/rule/rule.module.ts` 为：

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RuleEntity } from '../../common/entities/rule.entity';
import { RuleController } from './rule.controller';
import { RuleService } from './rule.service';

@Module({
  imports: [TypeOrmModule.forFeature([RuleEntity])],
  controllers: [RuleController],
  providers: [RuleService],
  exports: [RuleService],
})
export class RuleModule {}
```

- [ ] **Step 2: 改造 RuleService**

替换 `backend/src/modules/rule/rule.service.ts` 为：

```typescript
import { Injectable, OnModuleInit, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RuleEntity, RuleCategory, ConflictStrategy } from '../../common/entities/rule.entity';
import { CreateRuleDto } from './dto/create-rule.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';

const BUILTIN_RULES: Partial<RuleEntity>[] = [
  {
    id: 'builtin-concise',
    name: '简洁回复',
    content: '请保持回答简洁明了，避免冗长的解释。',
    enabled: true,
    category: RuleCategory.FORMAT,
    priority: 5,
    conflict_strategy: ConflictStrategy.MERGE,
    is_builtin: true,
  },
  {
    id: 'builtin-detailed',
    name: '详细解释',
    content: '请提供详细的解释和示例，帮助用户深入理解。',
    enabled: false,
    category: RuleCategory.FORMAT,
    priority: 5,
    conflict_strategy: ConflictStrategy.MERGE,
    is_builtin: true,
  },
  {
    id: 'builtin-polite',
    name: '礼貌用语',
    content: '使用礼貌、专业的语言与用户交流。',
    enabled: true,
    category: RuleCategory.BEHAVIOR,
    priority: 6,
    conflict_strategy: ConflictStrategy.MERGE,
    is_builtin: true,
  },
  {
    id: 'builtin-no-emoji',
    name: '不用表情',
    content: '不要使用表情符号，保持正式的回复风格。',
    enabled: false,
    category: RuleCategory.CONSTRAINT,
    priority: 7,
    conflict_strategy: ConflictStrategy.OVERRIDE,
    is_builtin: true,
  },
  {
    id: 'builtin-code-highlight',
    name: '代码高亮',
    content: '代码块请使用正确的语法高亮标记语言类型。',
    enabled: true,
    category: RuleCategory.FORMAT,
    priority: 5,
    conflict_strategy: ConflictStrategy.MERGE,
    is_builtin: true,
  },
];

@Injectable()
export class RuleService implements OnModuleInit {
  constructor(
    @InjectRepository(RuleEntity)
    private ruleRepo: Repository<RuleEntity>,
  ) {}

  async onModuleInit() {
    for (const rule of BUILTIN_RULES) {
      const exists = await this.ruleRepo.existsBy({ id: rule.id });
      if (!exists) {
        await this.ruleRepo.save(this.ruleRepo.create(rule));
      }
    }
  }

  async findAll(enabledOnly = false): Promise<RuleEntity[]> {
    if (enabledOnly) {
      return this.ruleRepo.find({ where: { enabled: true } });
    }
    return this.ruleRepo.find();
  }

  async findOne(id: string): Promise<RuleEntity> {
    const rule = await this.ruleRepo.findOneBy({ id });
    if (!rule) {
      throw new NotFoundException(`Rule ${id} not found`);
    }
    return rule;
  }

  async create(dto: CreateRuleDto): Promise<RuleEntity> {
    const rule = this.ruleRepo.create({
      name: dto.name,
      content: dto.content,
      enabled: true,
      category: dto.category || RuleCategory.FORMAT,
      priority: 5,
      conflict_strategy: ConflictStrategy.MERGE,
      is_builtin: false,
    });
    return this.ruleRepo.save(rule);
  }

  async update(id: string, dto: UpdateRuleDto): Promise<RuleEntity> {
    const rule = await this.findOne(id);
    Object.assign(rule, dto);
    return this.ruleRepo.save(rule);
  }

  async remove(id: string): Promise<void> {
    const rule = await this.findOne(id);
    if (rule.is_builtin) {
      throw new BadRequestException('Cannot delete built-in rules');
    }
    await this.ruleRepo.delete(id);
  }

  async getEnabledRules(): Promise<RuleEntity[]> {
    const rules = await this.findAll(true);
    return rules.sort((a, b) => b.priority - a.priority);
  }
}
```

注意：`RuleCategory` 和 `ConflictStrategy` 枚举现在从 `rule.entity.ts` 导出。原 `create-rule.dto.ts` 中的枚举定义需要改为从 entity 重新导出，或者直接删除 dto 中的枚举定义。

- [ ] **Step 3: 更新 create-rule.dto.ts 枚举引用**

替换 `backend/src/modules/rule/dto/create-rule.dto.ts` 为：

```typescript
import { IsString, IsOptional, IsNotEmpty, IsEnum } from 'class-validator';
import { RuleCategory, ConflictStrategy } from '../../../common/entities/rule.entity';

export { RuleCategory, ConflictStrategy };

export class CreateRuleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsEnum(RuleCategory)
  @IsOptional()
  category?: RuleCategory;
}
```

- [ ] **Step 4: 检查 RuleController**

检查 `backend/src/modules/rule/rule.controller.ts`，确认所有调用 RuleService 方法的地方使用 `await`。

---

### Task 5: ChatService 改造

**Files:**
- Modify: `backend/src/modules/chat/chat.module.ts`
- Modify: `backend/src/modules/chat/chat.service.ts`

这是最复杂的改造，因为 Session 包含关联的 Message，且 `streamCompletion` 中有内存状态操作。

- [ ] **Step 1: 更新 ChatModule 注册 Entity**

替换 `backend/src/modules/chat/chat.module.ts` 为：

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SessionEntity } from '../../common/entities/session.entity';
import { MessageEntity } from '../../common/entities/message.entity';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { AgentModule } from '../agent/agent.module';
import { RuleModule } from '../rule/rule.module';
import { MemoryModule } from '../memory/memory.module';
import { LangGraphModule } from '../langgraph/langgraph.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SessionEntity, MessageEntity]),
    AgentModule,
    RuleModule,
    MemoryModule,
    LangGraphModule,
  ],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService],
})
export class ChatModule {}
```

- [ ] **Step 2: 改造 ChatService**

替换 `backend/src/modules/chat/chat.service.ts` 为：

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { SessionEntity } from '../../common/entities/session.entity';
import { MessageEntity, MessageRole } from '../../common/entities/message.entity';
import { AgentService } from '../agent/agent.service';
import { RuleService } from '../rule/rule.service';
import { MemoryService } from '../memory/memory.service';
import { LangGraphService } from '../langgraph/langgraph.service';
import type { StreamEvent } from '../langgraph/langgraph.service';
import { CreateCompletionDto } from './dto/create-completion.dto';
import { CreateSessionDto } from './dto/create-session.dto';
import { UpdateSessionDto } from './dto/update-session.dto';

@Injectable()
export class ChatService {
  constructor(
    @InjectRepository(SessionEntity)
    private sessionRepo: Repository<SessionEntity>,
    @InjectRepository(MessageEntity)
    private messageRepo: Repository<MessageEntity>,
    private agentService: AgentService,
    private ruleService: RuleService,
    private memoryService: MemoryService,
    private langGraphService: LangGraphService,
  ) {}

  async createCompletion(dto: CreateCompletionDto) {
    const { message, session_id, stream, agent_id, rule_ids } = dto;

    const session = session_id
      ? await this.getSession(session_id)
      : await this.createSession({ title: 'New Chat' });

    const userMessage = this.messageRepo.create({
      id: uuidv4(),
      role: 'user' as MessageRole,
      content: message,
      session: { id: session.id } as SessionEntity,
    });
    await this.messageRepo.save(userMessage);

    // Reload session with messages
    const sessionWithMessages = await this.sessionRepo.findOne({
      where: { id: session.id },
      relations: ['messages'],
    });

    const systemPrompt = await this.buildSystemPrompt(agent_id, rule_ids);
    const messages = sessionWithMessages.messages.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    if (stream) {
      return { session: sessionWithMessages, stream: true, messages, systemPrompt };
    }

    const response = await this.langGraphService.chat(messages, systemPrompt, session.id);
    const assistantMessage = this.messageRepo.create({
      id: uuidv4(),
      role: 'assistant' as MessageRole,
      content: response.content,
      session: { id: session.id } as SessionEntity,
    });
    await this.messageRepo.save(assistantMessage);

    session.updated_at = new Date();
    await this.sessionRepo.save(session);

    return { session: sessionWithMessages, assistantMessage, finish_reason: response.finish_reason };
  }

  async *streamCompletion(
    messages: { role: MessageRole; content: string }[],
    systemPrompt: string,
    sessionId: string,
    messageId: string,
  ): AsyncGenerator<{ event: string; data: any }> {
    yield {
      event: 'message_start',
      data: { session_id: sessionId, message_id: messageId, role: 'assistant' },
    };

    let fullContent = '';
    let hasError = false;

    try {
      for await (const event of this.langGraphService.chatStream(messages, systemPrompt, sessionId)) {
        const base = { session_id: sessionId, message_id: messageId };

        switch (event.type) {
          case 'text':
            fullContent += event.content;
            yield { event: 'content_delta', data: { ...base, content: event.content } };
            break;

          case 'tool_start':
            yield { event: 'tool_call_start', data: { ...base, tool_call_id: event.toolCallId, tool_name: event.toolName } };
            break;

          case 'tool_delta':
            yield { event: 'tool_call_delta', data: { ...base, tool_call_id: event.toolCallId, args_delta: event.argsDelta } };
            break;

          case 'tool_input':
            yield { event: 'tool_call_input', data: { ...base, tool_call_id: event.toolCallId, tool_name: event.toolName, input: event.args } };
            break;

          case 'tool_output':
            yield { event: 'tool_call_output', data: { ...base, tool_call_id: event.toolCallId, output: event.output } };
            break;

          case 'step_start':
            yield { event: 'step_start', data: base };
            break;

          case 'finish':
            yield { event: 'message_done', data: { ...base, finish_reason: event.finishReason } };
            break;
        }
      }
    } catch (error) {
      hasError = true;
      yield {
        event: 'error',
        data: { session_id: sessionId, error: error.message, code: 'LLM_ERROR' },
      };
    }

    if (fullContent) {
      const msg = this.messageRepo.create({
        id: messageId,
        role: 'assistant' as MessageRole,
        content: fullContent,
        session: { id: sessionId } as SessionEntity,
      });
      await this.messageRepo.save(msg);

      await this.sessionRepo.update(sessionId, { updated_at: new Date() });
    }

    if (!hasError) {
      yield { event: 'done', data: {} };
    }
  }

  async createSession(dto: CreateSessionDto): Promise<SessionEntity> {
    const session = this.sessionRepo.create({
      id: uuidv4(),
      title: dto.title || 'New Chat',
      is_pinned: false,
    });
    return this.sessionRepo.save(session);
  }

  async getSessions(page = 1, pageSize = 20) {
    const [all, total] = await this.sessionRepo.findAndCount({
      relations: ['messages'],
      order: { is_pinned: 'DESC', updated_at: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const totalPages = Math.ceil(total / pageSize);
    const sessions = all.map(({ messages, ...rest }) => ({ ...rest, message_count: messages.length }));

    return {
      data: sessions,
      pagination: { total, page, page_size: pageSize, total_pages: totalPages },
    };
  }

  async getSession(id: string): Promise<SessionEntity> {
    const session = await this.sessionRepo.findOne({
      where: { id },
      relations: ['messages'],
    });
    if (!session) throw new NotFoundException(`Session ${id} not found`);
    return session;
  }

  async togglePin(id: string, dto: UpdateSessionDto): Promise<SessionEntity> {
    const session = await this.getSession(id);
    session.is_pinned = dto.is_pinned;
    session.updated_at = new Date();
    return this.sessionRepo.save(session);
  }

  async getMessages(sessionId: string): Promise<MessageEntity[]> {
    const session = await this.getSession(sessionId);
    return session.messages;
  }

  private async buildSystemPrompt(agentId?: string, ruleIds?: string[]): Promise<string> {
    const parts: string[] = [];

    const resolvedAgentId = agentId || 'builtin-general';
    try {
      const agent = await this.agentService.findOne(resolvedAgentId);
      if (agent.system_prompt) parts.push(agent.system_prompt);
    } catch { /* skip */ }

    const enabledRules = await this.ruleService.getEnabledRules();
    const targetRules = ruleIds
      ? enabledRules.filter((r) => ruleIds.includes(r.id))
      : enabledRules;
    if (targetRules.length > 0) {
      parts.push(...targetRules.map((r) => r.content));
    }

    const memoryContext = await this.memoryService.buildMemoryContext();
    if (memoryContext) parts.push(memoryContext);

    return parts.join('\n\n');
  }
}
```

关键变更：
- `sessions` Map → `sessionRepo` + `messageRepo`
- `getSession` 使用 `relations: ['messages']` 加载关联消息
- `getSessions` 使用 `findAndCount` + `order: { is_pinned: 'DESC', updated_at: 'DESC' }` 替代手动排序
- `streamCompletion` 中流结束后保存 assistant message 到数据库
- `buildSystemPrompt` 变为 `async`（调用 AgentService/RuleService 的 async 方法）

- [ ] **Step 3: 检查 ChatController**

检查 `backend/src/modules/chat/chat.controller.ts`，确认 `createCompletion` 和 `streamCompletion` 的调用使用 `await`。

---

### Task 6: MemoryService 基础改造（仅 TypeORM）

**Files:**
- Modify: `backend/src/modules/memory/memory.module.ts`
- Modify: `backend/src/modules/memory/memory.service.ts`
- Modify: `backend/src/modules/memory/dto/create-memory.dto.ts`

- [ ] **Step 1: 更新 create-memory.dto.ts 枚举引用**

替换 `backend/src/modules/memory/dto/create-memory.dto.ts` 为：

```typescript
import { IsString, IsOptional, IsNotEmpty, IsEnum, IsInt, Min, Max } from 'class-validator';
import { MemoryType } from '../../../common/entities/memory.entity';

export { MemoryType };

export class CreateMemoryDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsEnum(MemoryType)
  @IsOptional()
  type?: MemoryType;

  @IsString()
  @IsOptional()
  source_session_id?: string;

  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  importance?: number;
}
```

- [ ] **Step 2: 更新 MemoryModule 注册 Entity**

替换 `backend/src/modules/memory/memory.module.ts` 为：

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemoryEntity } from '../../common/entities/memory.entity';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';

@Module({
  imports: [TypeOrmModule.forFeature([MemoryEntity])],
  controllers: [MemoryController],
  providers: [MemoryService],
  exports: [MemoryService],
})
export class MemoryModule {}
```

- [ ] **Step 3: 改造 MemoryService（不含 Milvus）**

替换 `backend/src/modules/memory/memory.service.ts` 为：

```typescript
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { MemoryEntity, MemoryType } from '../../common/entities/memory.entity';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';

@Injectable()
export class MemoryService {
  constructor(
    @InjectRepository(MemoryEntity)
    private memoryRepo: Repository<MemoryEntity>,
  ) {}

  async findAll(type?: string, minImportance?: number): Promise<MemoryEntity[]> {
    const qb = this.memoryRepo.createQueryBuilder('m');

    if (type) {
      qb.andWhere('m.type = :type', { type });
    }
    if (minImportance) {
      qb.andWhere('m.importance >= :minImportance', { minImportance });
    }

    return qb.getMany();
  }

  async findOne(id: string): Promise<MemoryEntity> {
    const memory = await this.memoryRepo.findOneBy({ id });
    if (!memory) {
      throw new NotFoundException(`Memory ${id} not found`);
    }
    return memory;
  }

  async create(dto: CreateMemoryDto): Promise<MemoryEntity> {
    const memory = this.memoryRepo.create({
      id: uuidv4(),
      content: dto.content,
      type: dto.type || MemoryType.FACT,
      source_session_id: dto.source_session_id || null,
      importance: dto.importance || 5,
      last_accessed: new Date(),
    });
    return this.memoryRepo.save(memory);
  }

  async update(id: string, dto: UpdateMemoryDto): Promise<MemoryEntity> {
    const memory = await this.findOne(id);
    Object.assign(memory, {
      ...dto,
      last_accessed: new Date(),
    });
    return this.memoryRepo.save(memory);
  }

  async remove(id: string): Promise<void> {
    const memory = await this.findOne(id);
    await this.memoryRepo.delete(id);
  }

  async buildMemoryContext(sessionId?: string): Promise<string> {
    const all = await this.findAll();
    const sorted = all.sort((a, b) => b.importance - a.importance);
    if (sorted.length === 0) return '';

    const typeLabel: Record<string, string> = {
      [MemoryType.FACT]: '事实',
      [MemoryType.PREFERENCE]: '偏好',
      [MemoryType.EVENT]: '事件',
    };

    const lines = sorted.map((m) => `- [${typeLabel[m.type] || m.type}] ${m.content}`);
    return `以下是关于用户的已知信息：\n${lines.join('\n')}`;
  }
}
```

- [ ] **Step 4: 检查 MemoryController**

检查 `backend/src/modules/memory/memory.controller.ts`，确认所有调用使用 `await`。

---

### Task 7: EmbeddingService + MilvusService 创建与集成

**Files:**
- Create: `backend/src/modules/memory/embedding.service.ts`
- Create: `backend/src/modules/memory/milvus.service.ts`
- Modify: `backend/src/modules/memory/memory.module.ts`
- Modify: `backend/src/modules/memory/memory.service.ts`

- [ ] **Step 1: 创建 EmbeddingService**

创建 `backend/src/modules/memory/embedding.service.ts`：

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAIEmbeddings } from '@langchain/openai';

@Injectable()
export class EmbeddingService implements OnModuleInit {
  private embeddings: OpenAIEmbeddings;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    this.embeddings = new OpenAIEmbeddings({
      model: this.configService.get('EMBEDDINGS_MODEL_NAME', 'text-embedding-v3'),
      configuration: {
        apiKey: this.configService.get('OPENAI_API_KEY'),
        baseURL: this.configService.get('OPENAI_BASE_URL'),
      },
    });
  }

  async embedQuery(text: string): Promise<number[]> {
    return this.embeddings.embedQuery(text);
  }

  async embedDocuments(texts: string[]): Promise<number[][]> {
    return this.embeddings.embedDocuments(texts);
  }
}
```

- [ ] **Step 2: 创建 MilvusService**

创建 `backend/src/modules/memory/milvus.service.ts`：

```typescript
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MilvusClient, DataType, MetricType, IndexType } from '@zilliz/milvus2-sdk-node';

const COLLECTION_NAME = 'memories';

@Injectable()
export class MilvusService implements OnModuleInit {
  private client: MilvusClient;
  private readonly logger = new Logger(MilvusService.name);

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const address = this.configService.get('MILVUS_ADDRESS', 'localhost:19530');
    const dimension = this.configService.get<number>('EMBEDDINGS_DIMENSION', 1536);

    this.client = new MilvusClient({ address });
    await this.ensureCollection(dimension);
    this.logger.log('Milvus connected and collection ready');
  }

  async insert(id: string, embedding: number[], memoryType: string): Promise<void> {
    await this.client.insert({
      collection_name: COLLECTION_NAME,
      data: [{ id, embedding, memory_type: memoryType }],
    });
  }

  async search(embedding: number[], limit: number, memoryType?: string): Promise<string[]> {
    const searchParams: any = {
      collection_name: COLLECTION_NAME,
      vector: embedding,
      limit,
      output_fields: ['id'],
    };

    if (memoryType) {
      searchParams.filter = `memory_type == "${memoryType}"`;
    }

    const results = await this.client.search(searchParams);
    return results.data.map((r: any) => r.id);
  }

  async delete(id: string): Promise<void> {
    await this.client.delete({
      collection_name: COLLECTION_NAME,
      ids: [id],
    });
  }

  private async ensureCollection(dimension: number): Promise<void> {
    const exists = await this.client.hasCollection({ collection_name: COLLECTION_NAME });
    if (exists.value) return;

    await this.client.createCollection({
      collection_name: COLLECTION_NAME,
      fields: [
        { name: 'id', data_type: DataType.VarChar, is_primary_key: true, max_length: 36 },
        { name: 'embedding', data_type: DataType.FloatVector, dim: dimension },
        { name: 'memory_type', data_type: DataType.VarChar, max_length: 20 },
      ],
    });

    await this.client.createIndex({
      collection_name: COLLECTION_NAME,
      field_name: 'embedding',
      index_type: IndexType.IVF_FLAT,
      metric_type: MetricType.COSINE,
      params: { nlist: 128 },
    });

    await this.client.loadCollection({ collection_name: COLLECTION_NAME });
    this.logger.log(`Created Milvus collection "${COLLECTION_NAME}" (dim=${dimension})`);
  }
}
```

- [ ] **Step 3: 更新 MemoryModule 注册新 Provider**

替换 `backend/src/modules/memory/memory.module.ts` 为：

```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MemoryEntity } from '../../common/entities/memory.entity';
import { MemoryController } from './memory.controller';
import { MemoryService } from './memory.service';
import { EmbeddingService } from './embedding.service';
import { MilvusService } from './milvus.service';

@Module({
  imports: [TypeOrmModule.forFeature([MemoryEntity])],
  controllers: [MemoryController],
  providers: [MemoryService, EmbeddingService, MilvusService],
  exports: [MemoryService],
})
export class MemoryModule {}
```

- [ ] **Step 4: 改造 MemoryService 集成 Milvus**

替换 `backend/src/modules/memory/memory.service.ts` 为：

```typescript
import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { MemoryEntity, MemoryType } from '../../common/entities/memory.entity';
import { CreateMemoryDto } from './dto/create-memory.dto';
import { UpdateMemoryDto } from './dto/update-memory.dto';
import { EmbeddingService } from './embedding.service';
import { MilvusService } from './milvus.service';

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    @InjectRepository(MemoryEntity)
    private memoryRepo: Repository<MemoryEntity>,
    private embeddingService: EmbeddingService,
    private milvusService: MilvusService,
  ) {}

  async findAll(type?: string, minImportance?: number): Promise<MemoryEntity[]> {
    const qb = this.memoryRepo.createQueryBuilder('m');

    if (type) {
      qb.andWhere('m.type = :type', { type });
    }
    if (minImportance) {
      qb.andWhere('m.importance >= :minImportance', { minImportance });
    }

    return qb.getMany();
  }

  async findOne(id: string): Promise<MemoryEntity> {
    const memory = await this.memoryRepo.findOneBy({ id });
    if (!memory) {
      throw new NotFoundException(`Memory ${id} not found`);
    }
    return memory;
  }

  async create(dto: CreateMemoryDto): Promise<MemoryEntity> {
    const memory = this.memoryRepo.create({
      id: uuidv4(),
      content: dto.content,
      type: dto.type || MemoryType.FACT,
      source_session_id: dto.source_session_id || null,
      importance: dto.importance || 5,
      last_accessed: new Date(),
    });
    const saved = await this.memoryRepo.save(memory);

    // 写入 Milvus（失败不阻塞）
    try {
      const embedding = await this.embeddingService.embedQuery(dto.content);
      await this.milvusService.insert(saved.id, embedding, saved.type);
    } catch (error) {
      this.logger.warn(`Failed to index memory ${saved.id} in Milvus: ${error.message}`);
    }

    return saved;
  }

  async update(id: string, dto: UpdateMemoryDto): Promise<MemoryEntity> {
    const memory = await this.findOne(id);
    Object.assign(memory, {
      ...dto,
      last_accessed: new Date(),
    });
    const saved = await this.memoryRepo.save(memory);

    // 如果 content 变了，重新生成 embedding
    if (dto.content) {
      try {
        await this.milvusService.delete(id);
        const embedding = await this.embeddingService.embedQuery(dto.content);
        await this.milvusService.insert(id, embedding, saved.type);
      } catch (error) {
        this.logger.warn(`Failed to re-index memory ${id} in Milvus: ${error.message}`);
      }
    }

    return saved;
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.memoryRepo.delete(id);

    try {
      await this.milvusService.delete(id);
    } catch (error) {
      this.logger.warn(`Failed to delete memory ${id} from Milvus: ${error.message}`);
    }
  }

  async buildMemoryContext(sessionId?: string): Promise<string> {
    const all = await this.findAll();
    const sorted = all.sort((a, b) => b.importance - a.importance);
    if (sorted.length === 0) return '';

    const typeLabel: Record<string, string> = {
      [MemoryType.FACT]: '事实',
      [MemoryType.PREFERENCE]: '偏好',
      [MemoryType.EVENT]: '事件',
    };

    const lines = sorted.map((m) => `- [${typeLabel[m.type] || m.type}] ${m.content}`);
    return `以下是关于用户的已知信息：\n${lines.join('\n')}`;
  }

  /**
   * 语义检索：通过 embedding 在 Milvus 中搜索相似 Memory
   */
  async searchBySemantic(query: string, limit = 10, memoryType?: string): Promise<MemoryEntity[]> {
    const embedding = await this.embeddingService.embedQuery(query);
    const ids = await this.milvusService.search(embedding, limit, memoryType);

    if (ids.length === 0) return [];

    const memories = await this.memoryRepo.findBy({ id: In(ids) });

    // 按 Milvus 返回的相似度顺序排列
    const idOrder = new Map(ids.map((id, index) => [id, index]));
    return memories.sort((a, b) => idOrder.get(a.id)! - idOrder.get(b.id)!);
  }
}
```

---

### Task 8: Controller 层适配 + 编译验证

**Files:**
- Modify: `backend/src/modules/agent/agent.controller.ts`（确认 await）
- Modify: `backend/src/modules/rule/rule.controller.ts`（确认 await）
- Modify: `backend/src/modules/chat/chat.controller.ts`（确认 await）
- Modify: `backend/src/modules/memory/memory.controller.ts`（确认 await + 新增语义检索端点）

- [ ] **Step 1: 读取并适配所有 Controller**

逐个读取 4 个 Controller 文件，确认所有 Service 调用都使用 `await`。如果原来就用了（因为 NestJS Controller 方法通常是 async），则无需修改。

在 MemoryController 中新增语义检索端点：

```typescript
@Get('search')
async searchBySemantic(
  @Query('query') query: string,
  @Query('limit') limit?: string,
  @Query('type') type?: string,
) {
  const results = await this.memoryService.searchBySemantic(
    query,
    limit ? parseInt(limit, 10) : 10,
    type,
  );
  return { success: true, data: results, message: 'ok', code: 'SUCCESS' };
}
```

- [ ] **Step 2: 编译验证**

Run: `cd /vol2/1000/机械硬盘1/Linux/workspace/Chat-Bot/backend && pnpm build`

Expected: 编译成功，无 TypeScript 错误

- [ ] **Step 3: Docker 启动 + 应用启动验证**

Run: `cd /vol2/1000/机械硬盘1/Linux/workspace/Chat-Bot && docker compose up -d`

等待容器 healthy 后：

Run: `cd /vol2/1000/机械硬盘1/Linux/workspace/Chat-Bot/backend && pnpm dev`

Expected：
- TypeORM 连接 PostgreSQL 成功
- 表自动创建（sessions, messages, agents, rules, memories）
- 内置 Agent（3 个）和 Rule（5 个）自动 seed
- Milvus 连接成功，collection 自动创建
- 应用监听 8088 端口

- [ ] **Step 4: 功能验证**

用 curl 或前端验证：
1. `GET /agents` — 返回 3 个内置 Agent
2. `POST /sessions` → `POST /chat/completions` — 创建会话并发送消息
3. `GET /sessions` — 返回带消息计数的会话列表
4. `POST /memories` — 创建 Memory，检查 PG + Milvus 数据
5. `GET /memories/search?query=xxx` — 语义检索 Memory

---

## Self-Review

**1. Spec 覆盖检查：**
- Docker Compose（PG + Milvus）→ Task 1
- 5 个 Entity → Task 2
- AgentService 改造 → Task 3
- RuleService 改造 → Task 4
- ChatService 改造 → Task 5
- MemoryService 基础改造 → Task 6
- EmbeddingService + MilvusService → Task 7
- Controller 适配 + 验证 → Task 8
- 无遗漏

**2. Placeholder 扫描：** 无 TBD/TODO/模糊描述，每步有完整代码

**3. 类型一致性检查：**
- Entity 字段名与原 interface 一致（id, name, content 等）
- 枚举从 Entity 导出，DTO 重新导出
- Service 方法签名统一使用 Entity 类型
- `searchBySemantic` 返回 `MemoryEntity[]` 与 `findAll` 一致
