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
