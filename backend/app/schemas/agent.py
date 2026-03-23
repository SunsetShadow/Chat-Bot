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


# 内置 Agent 数据
BUILTIN_AGENTS: list[Agent] = [
    Agent(
        id="builtin-general",
        name="通用助手",
        description="默认的 AI 助手，可以回答各类问题",
        system_prompt="你是一个友好、专业的 AI 助手。请用简洁、准确的语言回答用户的问题。",
        traits=["友好", "专业", "简洁"],
        is_builtin=True,
    ),
    Agent(
        id="builtin-programmer",
        name="编程专家",
        description="专业的编程问题解答，精通多种编程语言和框架",
        system_prompt="你是一个资深的编程专家。请提供规范的代码、最佳实践和清晰的解释。代码需要包含必要的注释。",
        traits=["专业", "代码规范", "最佳实践"],
        is_builtin=True,
    ),
    Agent(
        id="builtin-writer",
        name="写作助手",
        description="文案、创意写作支持，擅长各种文体",
        system_prompt="你是一个专业的写作助手。请用优美的语言、清晰的结构来帮助用户完成各类写作任务。",
        traits=["文采", "创意", "结构清晰"],
        is_builtin=True,
    ),
]
