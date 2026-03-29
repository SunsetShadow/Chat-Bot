# Agent 模块重构设计

## 背景

Agent 相关代码分散在 3 个目录中（`api/v1/`、`schemas/`、`services/`），且 BUILTIN_AGENTS 数据定义在 schemas 层。随着 Agent 复杂度增长，需要将 Agent 代码聚合为独立模块。

## 方案

采用自包含模块方案，在 `app/agents/` 下集中所有 Agent 相关代码。

### 目录结构

```
app/agents/
├── __init__.py          # 导出公共接口
├── routes.py            # FastAPI router, prefix="/agents"
├── schemas.py           # Agent, AgentCreate, AgentUpdate, AgentResponse
├── service.py           # AgentService class + get_agent_service()
└── prompts/
    ├── __init__.py      # load_builtin_agents() 汇总注册
    ├── general.py       # GENERAL_AGENT 定义
    ├── programmer.py    # PROGRAMMER_AGENT 定义
    └── writer.py        # WRITER_AGENT 定义
```

### 迁移映射

| 原路径 | 新路径 | 说明 |
|--------|--------|------|
| `app/api/v1/agent.py` | `app/agents/routes.py` | 路由代码 |
| `app/schemas/agent.py` | `app/agents/schemas.py` | 数据模型（不含 BUILTIN_AGENTS） |
| `app/services/agent_service.py` | `app/agents/service.py` | 业务逻辑 |
| `app/schemas/agent.py` 中的 BUILTIN_AGENTS | `app/agents/prompts/*.py` | 每个 Agent 一个文件 |

### 影响范围

需修改 import 路径的文件：

- `app/api/v1/router.py` — 改为 `from app.agents.routes import router as agent_router`
- `app/services/chat_service.py` — 改为 `from app.agents.service import AgentService`

需删除的旧文件：

- `app/api/v1/agent.py`
- `app/schemas/agent.py`
- `app/services/agent_service.py`

API 路径不变，前端无需修改。

### prompts/ 设计

每个 prompt 文件导出一个 dict，包含 Agent 的定义数据。`__init__.py` 汇总为 `BUILTIN_AGENTS` 列表，供 `service.py` 初始化。新增内置 Agent 只需加一个文件 + 在 `__init__.py` 注册。

```python
# prompts/general.py
GENERAL_AGENT = {
    "id": "builtin-general",
    "name": "通用助手",
    "description": "默认的 AI 助手，可以回答各类问题",
    "system_prompt": "你是一个友好、专业的 AI 助手。请用简洁、准确的语言回答用户的问题。",
    "traits": ["友好", "专业", "简洁"],
}
```

```python
# prompts/__init__.py
from app.agents.prompts.general import GENERAL_AGENT
from app.agents.prompts.programmer import PROGRAMMER_AGENT
from app.agents.prompts.writer import WRITER_AGENT

BUILTIN_AGENTS = [GENERAL_AGENT, PROGRAMMER_AGENT, WRITER_AGENT]
```

### `__init__.py` 公共接口

```python
from app.agents.service import AgentService, get_agent_service
from app.agents.schemas import Agent, AgentCreate, AgentUpdate, AgentResponse
```

### 文档更新

更新以下 openspec 文档：

- `openspec/specs/development/spec.md` — 目录结构、关键文件表
- `openspec/specs/core-features/spec.md` — 关键文件表

## 不做的事

- 不修改 API 路径或行为
- 不添加新功能（如 Agent 工具、多 LLM provider）
- 不重构 rule、memory 等其他模块
- 不引入新依赖
