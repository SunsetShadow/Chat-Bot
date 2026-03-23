from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.base import generate_id, get_current_timestamp


class MemoryType(str, Enum):
    """记忆类型"""

    FACT = "fact"  # 事实信息
    PREFERENCE = "preference"  # 偏好设置
    EVENT = "event"  # 事件记录


class Memory(BaseModel):
    """记忆模型"""

    id: str = Field(default_factory=generate_id)
    content: str
    type: MemoryType = MemoryType.FACT
    source_session_id: Optional[str] = None
    importance: int = Field(default=5, ge=1, le=10)
    created_at: datetime = Field(default_factory=get_current_timestamp)
    last_accessed: datetime = Field(default_factory=get_current_timestamp)


class MemoryCreate(BaseModel):
    """创建记忆请求"""

    content: str = Field(..., min_length=1, max_length=2000)
    type: MemoryType = MemoryType.FACT
    source_session_id: Optional[str] = None
    importance: int = Field(5, ge=1, le=10)


class MemoryUpdate(BaseModel):
    """更新记忆请求"""

    content: Optional[str] = Field(None, min_length=1, max_length=2000)
    type: Optional[MemoryType] = None
    importance: Optional[int] = Field(None, ge=1, le=10)


class MemoryResponse(BaseModel):
    """记忆响应"""

    id: str
    content: str
    type: MemoryType
    source_session_id: Optional[str]
    importance: int
    created_at: datetime
    last_accessed: datetime
