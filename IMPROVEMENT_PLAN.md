# Chat Bot 项目改进计划

## 概述

基于 LangChain/LangGraph 最佳实践分析，本计划分为三个阶段进行改进。

---

## Phase 1: 紧急修复 (短期)

### 1.1 修复服务实例持久化问题 🔴

**问题**: 当前 `get_chat_service()` 每次创建新实例，导致会话和记忆数据丢失。

**解决方案**: 使用全局单例 + 全局存储

**修改文件**:
- `backend/app/services/chat_service.py` - 改为单例模式
- `backend/app/core/store.py` - 新增全局存储

**验收标准**:
- 多次请求后会话状态保持
- 多次请求后记忆数据保持

---

### 1.2 添加请求递归限制 🟡

**问题**: 无限制可能导致无限循环。

**解决方案**: 在 ChatRequest 中添加 max_iterations 配置项

**修改文件**:
- `backend/app/schemas/chat.py` - 添加 max_iterations 字段

**验收标准**:
- 请求迭代次数受限制
- 超出限制时返回明确错误

---

### 1.3 修复记忆提取使用结构化输出 🟡

**问题**: JSON 字符串解析容易出错。

**解决方案**: 使用 Pydantic + 结构化输出

**修改文件**:
- `backend/app/services/memory_service.py` - 重构记忆提取逻辑

**验收标准**:
- 记忆提取返回正确的结构化数据
- 提取失败时优雅降级

---

## Phase 2: LangGraph 迁移 (中期)

### 2.1 添加 LangGraph 依赖

**目标**: 引入 LangGraph 框架支持

**修改文件**:
- `backend/pyproject.toml` - 添加 langgraph、langchain-core、langchain-openai 依赖

---

### 2.2 创建 LangGraph Agent 服务

**目标**: 使用 create_agent() 模式重构聊天服务

**新增文件**:
- `backend/app/services/agent_service_v2.py` - 基于 LangGraph 的 Agent 服务

**功能要点**:
- 全局 checkpointer 持久化会话状态
- Agent 缓存机制
- thread_id 会话管理
- 流式响应支持

---

### 2.3 迁移 ChatService 使用 LangGraph

**目标**: 保持与原 ChatService 相同的接口，内部使用 LangGraph

**新增文件**:
- `backend/app/services/chat_service_v2.py` - 重构的聊天服务

**功能要点**:
- 使用全局存储
- 集成 Agent/Rule/Memory 服务
- 流式聊天支持
- 记忆自动提取

---

### 2.4 更新 API 路由使用新服务

**修改文件**:
- `backend/app/api/v1/chat.py` - 切换到 V2 服务

**验收标准**:
- LangGraph Agent 正常工作
- 会话状态通过 Checkpointer 持久化
- 流式响应正常工作
- 历史消息正确累积

---

## Phase 3: 生产环境增强 (长期)

### 3.1 添加向量数据库支持

**目标**: 用于记忆的语义检索

**新增文件**:
- `backend/app/services/vector_store.py` - 向量存储服务

**功能要点**:
- 记忆向量化和存储
- 语义搜索
- 记忆增删改查

---

### 3.2 添加数据库持久化

**目标**: 使用 PostgreSQL 替代内存存储

**新增文件**:
- `backend/app/db/session.py` - 数据库会话管理

**功能要点**:
- SQLAlchemy 配置
- 连接池管理
- 会话生命周期

---

### 3.3 使用 PostgreSQL Checkpointer

**目标**: 替换 MemorySaver 为持久化存储

**修改文件**:
- `backend/app/services/agent_service_v2.py` - 切换到 PostgresSaver

**验收标准**:
- 语义搜索返回相关记忆
- 会话数据持久化到数据库
- 服务重启后状态恢复

---

## 迁移时间表

| 阶段 | 任务 | 预计时间 | 优先级 |
|------|------|----------|--------|
| Phase 1.1 | 服务实例单例化 | 1h | 🔴 高 |
| Phase 1.2 | 添加递归限制 | 30m | 🟡 中 |
| Phase 1.3 | 结构化输出记忆提取 | 2h | 🟡 中 |
| Phase 2.1 | 添加 LangGraph 依赖 | 30m | 🟡 中 |
| Phase 2.2 | 创建 AgentServiceV2 | 4h | 🟡 中 |
| Phase 2.3 | 创建 ChatServiceV2 | 3h | 🟡 中 |
| Phase 2.4 | 更新 API 路由 | 1h | 🟡 中 |
| Phase 3.1 | 向量数据库 | 4h | 🟢 低 |
| Phase 3.2 | 数据库持久化 | 4h | 🟢 低 |
| Phase 3.3 | PostgreSQL Checkpointer | 2h | 🟢 低 |

---

## 测试验证清单

### Phase 1 完成后
- [ ] 多次请求后会话状态保持
- [ ] 多次请求后记忆数据保持
- [ ] 记忆提取返回正确的结构化数据

### Phase 2 完成后
- [ ] LangGraph Agent 正常工作
- [ ] 会话状态通过 Checkpointer 持久化
- [ ] 流式响应正常工作
- [ ] 历史消息正确累积

### Phase 3 完成后
- [ ] 语义搜索返回相关记忆
- [ ] 会话数据持久化到数据库
- [ ] 服务重启后状态恢复
