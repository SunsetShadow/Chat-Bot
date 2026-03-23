import json
from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field

from app.schemas.base import generate_id, get_current_timestamp


class SSEEventType:
    """SSE 事件类型常量"""

    MESSAGE_START = "message_start"
    CONTENT_DELTA = "content_delta"
    MESSAGE_DONE = "message_done"
    ERROR = "error"
    DONE = "done"


class SSEEvent(BaseModel):
    """SSE 事件基础模型"""

    event: str
    data: dict[str, Any]

    def to_sse_string(self) -> str:
        """转换为 SSE 格式字符串"""
        return f"event: {self.event}\ndata: {json.dumps(self.data, ensure_ascii=False, default=str)}\n\n"


class MessageStartData(BaseModel):
    """消息开始事件数据"""

    session_id: str
    message_id: str = Field(default_factory=generate_id)
    role: str = "assistant"


class ContentDeltaData(BaseModel):
    """内容增量事件数据"""

    session_id: str
    message_id: str
    content: str


class MessageDoneData(BaseModel):
    """消息完成事件数据"""

    session_id: str
    message_id: str
    finish_reason: str = "stop"


class DoneData(BaseModel):
    """会话完成事件数据"""

    session_id: str


class ErrorData(BaseModel):
    """错误事件数据"""

    session_id: Optional[str] = None
    error: str
    code: str = "ERROR"


def create_sse_event(event_type: str, data: dict[str, Any]) -> str:
    """创建 SSE 事件字符串"""
    event = SSEEvent(event=event_type, data=data)
    return event.to_sse_string()


def create_message_start_event(session_id: str, message_id: str) -> str:
    """创建消息开始事件"""
    data = MessageStartData(session_id=session_id, message_id=message_id)
    return create_sse_event(SSEEventType.MESSAGE_START, data.model_dump())


def create_content_delta_event(session_id: str, message_id: str, content: str) -> str:
    """创建内容增量事件"""
    data = ContentDeltaData(session_id=session_id, message_id=message_id, content=content)
    return create_sse_event(SSEEventType.CONTENT_DELTA, data.model_dump())


def create_message_done_event(session_id: str, message_id: str, finish_reason: str = "stop") -> str:
    """创建消息完成事件"""
    data = MessageDoneData(
        session_id=session_id, message_id=message_id, finish_reason=finish_reason
    )
    return create_sse_event(SSEEventType.MESSAGE_DONE, data.model_dump())


def create_done_event(session_id: str) -> str:
    """创建会话完成事件"""
    data = DoneData(session_id=session_id)
    return create_sse_event(SSEEventType.DONE, data.model_dump())


def create_error_event(error: str, code: str = "ERROR", session_id: Optional[str] = None) -> str:
    """创建错误事件"""
    data = ErrorData(session_id=session_id, error=error, code=code)
    return create_sse_event(SSEEventType.ERROR, data.model_dump())
