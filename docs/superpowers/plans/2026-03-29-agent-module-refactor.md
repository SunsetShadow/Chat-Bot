# Agent 模块重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将分散在 api/v1/、schemas/、services/ 的 Agent 代码迁移到 `app/agents/` 独立模块，便于后期扩展。

**Architecture:** 创建 `app/agents/` 自包含模块，包含 routes、schemas、service、prompts 四部分。BUILTIN_AGENTS 数据从 schemas 拆到 prompts/ 目录按文件管理。迁移后删除旧文件，更新 import 路径，API 行为不变。

**Tech Stack:** Python 3.14, FastAPI, Pydantic

---

## File Structure

| 操作 | 文件路径 | 职责 |
|------|----------|------|
| Create | `app/agents/__init__.py` | 导出公共接口 |
| Create | `app/agents/schemas.py` | Agent 数据模型 |
| Create | `app/agents/service.py` | Agent 业务逻辑 |
| Create | `app/agents/routes.py` | Agent API 路由 |
| Create | `app/agents/prompts/__init__.py` | 汇总 BUILTIN_AGENTS |
| Create | `app/agents/prompts/general.py` | 通用助手定义 |
| Create | `app/agents/prompts/programmer.py` | 编程专家定义 |
| Create | `app/agents/prompts/writer.py` | 写作助手定义 |
| Modify | `app/api/v1/router.py` | 更新 import 路径 |
| Modify | `app/services/chat_service.py` | 更新 import 路径 |
| Delete | `app/api/v1/agent.py` | 已迁移到 agents/routes.py |
| Delete | `app/schemas/agent.py` | 已迁移到 agents/schemas.py + prompts/ |
| Delete | `app/services/agent_service.py` | 已迁移到 agents/service.py |
| Modify | `openspec/specs/development/spec.md` | 更新目录结构和关键文件 |
| Modify | `openspec/specs/core-features/spec.md` | 更新关键文件表 |

---

### Task 1: 创建 prompts/ 目录 — 内置 Agent 定义

**Files:**
- Create: `backend/app/agents/prompts/general.py`
- Create: `backend/app/agents/prompts/programmer.py`
- Create: `backend/app/agents/prompts/writer.py`
- Create: `backend/app/agents/prompts/__init__.py`

- [ ] **Step 1: 创建 general.py**

```python
# backend/app/agents/prompts/general.py

GENERAL_AGENT = {
    "id": "builtin-general",
    "name": "通用助手",
    "description": "默认的 AI 助手，可以回答各类问题",
    "system_prompt": "你是一个友好、专业的 AI 助手。请用简洁、准确的语言回答用户的问题。",
    "traits": ["友好", "专业", "简洁"],
}
```

- [ ] **Step 2: 创建 programmer.py**

```python
# backend/app/agents/prompts/programmer.py

PROGRAMMER_AGENT = {
    "id": "builtin-programmer",
    "name": "编程专家",
    "description": "专业的编程问题解答，精通多种编程语言和框架",
    "system_prompt": "你是一个资深的编程专家。请提供规范的代码、最佳实践和清晰的解释。代码需要包含必要的注释。",
    "traits": ["专业", "代码规范", "最佳实践"],
}
```

- [ ] **Step 3: 创建 writer.py**

```python
# backend/app/agents/prompts/writer.py

WRITER_AGENT = {
    "id": "builtin-writer",
    "name": "写作助手",
    "description": "文案、创意写作支持，擅长各种文体",
    "system_prompt": "你是一个专业的写作助手。请用优美的语言、清晰的结构来帮助用户完成各类写作任务。",
    "traits": ["文采", "创意", "结构清晰"],
}
```

- [ ] **Step 4: 创建 prompts/__init__.py**

```python
# backend/app/agents/prompts/__init__.py

from app.agents.prompts.general import GENERAL_AGENT
from app.agents.prompts.programmer import PROGRAMMER_AGENT
from app.agents.prompts.writer import WRITER_AGENT

BUILTIN_AGENTS = [GENERAL_AGENT, PROGRAMMER_AGENT, WRITER_AGENT]
```

- [ ] **Step 5: 提交**

```bash
git add backend/app/agents/prompts/
git commit -m "refactor(agents): create prompts directory with builtin agent definitions"
```

---

### Task 2: 创建 agents/schemas.py

**Files:**
- Create: `backend/app/agents/schemas.py`

- [ ] **Step 1: 创建 schemas.py**

从 `app/schemas/agent.py` 迁移数据模型，但不包含 BUILTIN_AGENTS（已在 prompts/ 中）。import 路径从 `app.schemas.base` 改为 `app.schemas.base`（不变，因为 base.py 仍在原位）。

```python
# backend/app/agents/schemas.py

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.base import generate_id, get_current_timestamp


class Agent(BaseModel):
    """Agent 模型"""

    id: str = Field(default_factory=generate_id)
    name: str
    description: str = ""
    system_prompt: str = ""
    traits: list[str] = Field(default_factory=list)
    is_builtin: bool = False
    created_at: datetime = Field(default_factory=get_current_timestamp)
    updated_at: datetime = Field(default_factory=get_current_timestamp)


class AgentCreate(BaseModel):
    """创建 Agent 请求"""

    name: str = Field(..., min_length=1, max_length=100)
    description: str = Field("", max_length=500)
    system_prompt: str = Field("", max_length=5000)
    traits: list[str] = Field(default_factory=list)


class AgentUpdate(BaseModel):
    """更新 Agent 请求"""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    system_prompt: Optional[str] = Field(None, max_length=5000)
    traits: Optional[list[str]] = None


class AgentResponse(BaseModel):
    """Agent 响应"""

    id: str
    name: str
    description: str
    system_prompt: str
    traits: list[str]
    is_builtin: bool
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 2: 提交**

```bash
git add backend/app/agents/schemas.py
git commit -m "refactor(agents): create schemas module"
```

---

### Task 3: 创建 agents/service.py

**Files:**
- Create: `backend/app/agents/service.py`

- [ ] **Step 1: 创建 service.py**

从 `app/services/agent_service.py` 迁移业务逻辑。import 路径改为从 `app.agents.schemas` 和 `app.agents.prompts` 导入。

```python
# backend/app/agents/service.py

from functools import lru_cache

from app.core.exceptions import ValidationException, raise_not_found
from app.agents.prompts import BUILTIN_AGENTS
from app.agents.schemas import Agent, AgentCreate, AgentResponse, AgentUpdate


class AgentService:
    """Agent 服务"""

    def __init__(self):
        self._agents: dict[str, Agent] = {a["id"]: Agent(**a, is_builtin=True) for a in BUILTIN_AGENTS}

    def list_agents(self) -> list[AgentResponse]:
        """获取所有 Agent"""
        return [self.agent_to_response(agent) for agent in self._agents.values()]

    def get_agent(self, agent_id: str) -> Agent:
        """获取单个 Agent"""
        if agent_id not in self._agents:
            raise_not_found("Agent", agent_id)
        return self._agents[agent_id]

    def create_agent(self, request: AgentCreate) -> Agent:
        """创建自定义 Agent"""
        agent = Agent(
            name=request.name,
            description=request.description,
            system_prompt=request.system_prompt,
            traits=request.traits,
            is_builtin=False,
        )
        self._agents[agent.id] = agent
        return agent

    def update_agent(self, agent_id: str, request: AgentUpdate) -> Agent:
        """更新 Agent"""
        agent = self.get_agent(agent_id)

        if agent.is_builtin:
            raise ValidationException("Cannot modify builtin agent")

        if request.name is not None:
            agent.name = request.name
        if request.description is not None:
            agent.description = request.description
        if request.system_prompt is not None:
            agent.system_prompt = request.system_prompt
        if request.traits is not None:
            agent.traits = request.traits

        from app.schemas.base import get_current_timestamp

        agent.updated_at = get_current_timestamp()
        return agent

    def delete_agent(self, agent_id: str) -> bool:
        """删除 Agent"""
        agent = self.get_agent(agent_id)

        if agent.is_builtin:
            raise ValidationException("Cannot delete builtin agent")

        del self._agents[agent_id]
        return True

    def agent_to_response(self, agent: Agent) -> AgentResponse:
        """将 Agent 转换为响应格式"""
        return AgentResponse(
            id=agent.id,
            name=agent.name,
            description=agent.description,
            system_prompt=agent.system_prompt,
            traits=agent.traits,
            is_builtin=agent.is_builtin,
            created_at=agent.created_at,
            updated_at=agent.updated_at,
        )


@lru_cache
def get_agent_service() -> AgentService:
    """获取 AgentService 实例（单例）"""
    return AgentService()
```

- [ ] **Step 2: 提交**

```bash
git add backend/app/agents/service.py
git commit -m "refactor(agents): create service module"
```

---

### Task 4: 创建 agents/routes.py

**Files:**
- Create: `backend/app/agents/routes.py`

- [ ] **Step 1: 创建 routes.py**

从 `app/api/v1/agent.py` 迁移路由。import 路径改为从 `app.agents` 内部导入。

```python
# backend/app/agents/routes.py

from typing import Annotated

from fastapi import APIRouter, Depends

from app.agents.schemas import AgentCreate, AgentResponse, AgentUpdate
from app.schemas.base import DataResponse
from app.agents.service import AgentService, get_agent_service

router = APIRouter(prefix="/agents", tags=["Agents"])

AgentServiceDep = Annotated[AgentService, Depends(get_agent_service)]


@router.get("", response_model=DataResponse)
async def list_agents(service: AgentServiceDep):
    """获取所有 Agent 列表"""
    agents = service.list_agents()
    return DataResponse(data=agents)


@router.post("", response_model=DataResponse)
async def create_agent(request: AgentCreate, service: AgentServiceDep):
    """创建自定义 Agent"""
    agent = service.create_agent(request)
    return DataResponse(data=service.agent_to_response(agent))


@router.get("/{agent_id}", response_model=DataResponse)
async def get_agent(agent_id: str, service: AgentServiceDep):
    """获取 Agent 详情"""
    agent = service.get_agent(agent_id)
    return DataResponse(data=service.agent_to_response(agent))


@router.put("/{agent_id}", response_model=DataResponse)
async def update_agent(
    agent_id: str,
    request: AgentUpdate,
    service: AgentServiceDep,
):
    """更新 Agent（内置 Agent 不允许修改）"""
    agent = service.update_agent(agent_id, request)
    return DataResponse(data=service.agent_to_response(agent))


@router.delete("/{agent_id}")
async def delete_agent(agent_id: str, service: AgentServiceDep):
    """删除 Agent（内置 Agent 不允许删除）"""
    service.delete_agent(agent_id)
    return DataResponse(message="Agent deleted successfully")
```

- [ ] **Step 2: 提交**

```bash
git add backend/app/agents/routes.py
git commit -m "refactor(agents): create routes module"
```

---

### Task 5: 创建 agents/__init__.py 并切换 import 路径

**Files:**
- Create: `backend/app/agents/__init__.py`
- Modify: `backend/app/api/v1/router.py` (第 3 行, 第 15 行)
- Modify: `backend/app/services/chat_service.py` (第 26 行)

- [ ] **Step 1: 创建 __init__.py**

```python
# backend/app/agents/__init__.py

from app.agents.service import AgentService, get_agent_service
from app.agents.schemas import Agent, AgentCreate, AgentUpdate, AgentResponse
```

- [ ] **Step 2: 修改 router.py 的 import**

将 `backend/app/api/v1/router.py` 第 3 行：
```python
from app.api.v1.agent import router as agent_router
```
改为：
```python
from app.agents.routes import router as agent_router
```

- [ ] **Step 3: 修改 chat_service.py 的 import**

将 `backend/app/services/chat_service.py` 第 26 行：
```python
from app.services.agent_service import AgentService
```
改为：
```python
from app.agents.service import AgentService
```

- [ ] **Step 4: 启动后端验证无 import 错误**

Run: `cd backend && uv run python -c "from app.agents import AgentService, get_agent_service; print('import OK')"`

Expected: `import OK`

- [ ] **Step 5: 提交**

```bash
git add backend/app/agents/__init__.py backend/app/api/v1/router.py backend/app/services/chat_service.py
git commit -m "refactor(agents): wire up agents module and update imports"
```

---

### Task 6: 删除旧文件

**Files:**
- Delete: `backend/app/api/v1/agent.py`
- Delete: `backend/app/schemas/agent.py`
- Delete: `backend/app/services/agent_service.py`

- [ ] **Step 1: 删除三个旧文件**

```bash
rm backend/app/api/v1/agent.py
rm backend/app/schemas/agent.py
rm backend/app/services/agent_service.py
```

- [ ] **Step 2: 验证后端启动正常**

Run: `cd backend && uv run python -c "from app.main import app; print('app OK')"`

Expected: `app OK`

- [ ] **Step 3: 提交**

```bash
git add -u backend/app/api/v1/agent.py backend/app/schemas/agent.py backend/app/services/agent_service.py
git commit -m "refactor(agents): remove old agent files after migration"
```

---

### Task 7: 更新 openspec 文档

**Files:**
- Modify: `openspec/specs/development/spec.md` — 目录结构和关键文件表
- Modify: `openspec/specs/core-features/spec.md` — 关键文件表

- [ ] **Step 1: 更新 development/spec.md 目录结构**

在 `backend/app/` 目录树中添加 `agents/` 目录：

```
├── backend/                     # 后端项目
│   ├── app/
│   │   ├── agents/              # Agent 模块（自包含）
│   │   │   ├── prompts/         # 内置 Agent 定义
│   │   │   ├── routes.py        # Agent API 路由
│   │   │   ├── schemas.py       # Agent 数据模型
│   │   │   └── service.py       # Agent 业务逻辑
│   │   ├── api/v1/              # API 路由
```

- [ ] **Step 2: 更新 development/spec.md 关键文件表**

将：
```
| `backend/app/services/agent_service.py` | Agent 业务逻辑 |
```
改为：
```
| `backend/app/agents/` | Agent 模块（routes/schemas/service/prompts） |
```

- [ ] **Step 3: 更新 core-features/spec.md 关键文件表**

将：
```
| `backend/app/services/agent_service.py` | Agent 业务逻辑 |
```
改为：
```
| `backend/app/agents/` | Agent 模块（routes/schemas/service/prompts） |
```

- [ ] **Step 4: 提交**

```bash
git add openspec/specs/development/spec.md openspec/specs/core-features/spec.md
git commit -m "docs(openspec): update directory structure and key files for agents module"
```

---

### Task 8: 端到端验证

**Files:** 无新增

- [ ] **Step 1: 启动后端**

Run: `cd backend && uv run fastapi dev app/main.py`

- [ ] **Step 2: 验证 Agent API 端点**

Run: `curl -s http://localhost:8000/api/v1/agents | python3 -m json.tool`

Expected: 返回包含 3 个 builtin agent 的 JSON，`success: true`

- [ ] **Step 3: 验证聊天端点仍正常工作**

Run: `curl -s http://localhost:8000/api/v1/sessions | python3 -m json.tool`

Expected: 返回 `success: true`

- [ ] **Step 4: 确认无残留引用**

Run: `grep -r "from app.schemas.agent import" backend/app/ && grep -r "from app.services.agent_service import" backend/app/ && grep -r "from app.api.v1.agent import" backend/app/`

Expected: 无输出（无残留旧 import）
