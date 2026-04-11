# Proposal: 集成 TypeORM + Milvus 持久化层

**Change ID**: `integrate-typeorm-milvus`
**Status**: In Progress
**Created**: 2026-04-11

---

## Why

当前所有数据（Session、Message、Agent、Rule、Memory）存储在内存 `Map` 中：

1. **数据不持久**：服务重启后所有数据丢失，无法恢复历史会话
2. **无法语义检索**：Memory 仅支持精确匹配，缺少基于语义的相似度召回能力
3. **扩展受限**：内存存储无法支撑数据量增长，无法添加用户系统等需要持久化的功能

## What Changes

### 1. Docker Compose 基础设施

- 创建 `docker-compose.yml` 统一管理 PostgreSQL 16 + Milvus v2.4
- PG 存储所有结构化数据，Milvus 存储 Memory 的 embedding 向量
- 使用本地 volume 持久化数据

### 2. TypeORM Entity 定义

将 5 个内存接口转为 TypeORM Entity：

- **SessionEntity**：会话，关联 Message（一对多）和 Agent（多对一）
- **MessageEntity**：消息，属于 Session（多对一）
- **AgentEntity**：Agent 角色，关联 Session（一对多），内置数据自动 seed
- **RuleEntity**：规则，独立实体，内置数据自动 seed
- **MemoryEntity**：AI 记忆元数据，embedding 向量存 Milvus，通过 `id` 关联

实体关系：

```
Agent 1──N Session N──N Message

Rule (独立)    Memory (独立，embedding 存 Milvus)
```

### 3. Service 层改造

所有 Service 从 `Map<string, T>` 迁移到 TypeORM `Repository<T>`：

- **AgentService**：Map → Repository，`onModuleInit` seed 内置 Agent
- **RuleService**：Map → Repository，`onModuleInit` seed 内置 Rule
- **ChatService**：Map → Repository，Message 通过关联查询
- **MemoryService**：Map → Repository + MilvusService（写入双写，查询先 Milvus 后 PG）
- **ModelService**：不改造（静态数据）
- **UploadService**：不改造（文件系统存储）

### 4. Milvus 集成

- **MilvusService**：封装 Milvus 客户端，自动建 collection + 索引
- **EmbeddingService**：使用 `@langchain/openai` 的 `OpenAIEmbeddings`，模型名从 `.env` 读取
- Memory 数据流：
  - 写入：生成 embedding → 存 PG → 存 Milvus
  - 语义检索：生成查询向量 → Milvus 搜索 → PG 取完整数据
  - 删除：PG + Milvus 同步删除

### 5. 配置管理

`.env` 新增：

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
EMBEDDINGS_MODEL_NAME=text-embedding-3-small
EMBEDDINGS_DIMENSION=1536
```

## Impact

### 受影响的文件

| 类型 | 文件 | 影响 |
|------|------|------|
| 新增 | `docker-compose.yml` | PG + Milvus 容器编排 |
| 新增 | `backend/src/common/entities/*.entity.ts` | 5 个 TypeORM Entity |
| 新增 | `backend/src/modules/memory/embedding.service.ts` | Embedding 生成服务 |
| 新增 | `backend/src/modules/memory/milvus.service.ts` | Milvus 客户端封装 |
| 修改 | `backend/src/app.module.ts` | 注册 TypeORM |
| 修改 | `backend/src/modules/chat/chat.module.ts` | 注册 Entity |
| 修改 | `backend/src/modules/chat/chat.service.ts` | Map → Repository |
| 修改 | `backend/src/modules/agent/agent.module.ts` | 注册 Entity |
| 修改 | `backend/src/modules/agent/agent.service.ts` | Map → Repository |
| 修改 | `backend/src/modules/rule/rule.module.ts` | 注册 Entity |
| 修改 | `backend/src/modules/rule/rule.service.ts` | Map → Repository |
| 修改 | `backend/src/modules/memory/memory.module.ts` | 注册 Entity + Milvus |
| 修改 | `backend/src/modules/memory/memory.service.ts` | Map → Repository + Milvus |
| 修改 | `backend/.env` | 新增 DB / Milvus / Embedding 配置 |
| 修改 | `backend/package.json` | 新增 typeorm / pg / @zilliz/milvus2-sdk-node 依赖 |

### 受影响的规范

- `docs/specs/development/spec.md` - 技术栈新增 TypeORM + Milvus
- `docs/specs/core-features/spec.md` - 数据持久化架构变更

### 数据模型变更

所有接口保持不变，新增 TypeORM Entity 作为持久化映射。内部实现从 Map 切换到 Repository，对外 API 接口不变。

### 风险

| 风险 | 等级 | 应对 |
|------|------|------|
| Milvus 首次启动较慢 | 低 | Docker healthcheck + 应用启动重试 |
| Memory 双写一致性 | 低 | 先写 PG 再写 Milvus，Milvus 失败记日志不阻塞 |
| 内置数据 seed 重复 | 低 | `existsBy` 幂等检查 |
| `synchronize: true` 生产风险 | 中 | 后续切换到 migration |

## Scope

**包含**：

- Docker Compose（PG + Milvus）
- 5 个 TypeORM Entity
- 4 个 Service 改造（Agent / Rule / Chat / Memory）
- EmbeddingService + MilvusService
- .env 配置
- 端到端启动验证

**不包含**：

- 用户系统 / 认证
- 数据库 migration 管理（开发阶段用 synchronize）
- Message 向量化（仅 Memory 使用 Milvus）
- 前端改动（API 接口不变）
