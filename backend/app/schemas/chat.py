from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.base import generate_id, get_current_timestamp


# ============ 消息相关 ============

class MessageRole:
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class Message(BaseModel):
    """消息模型"""

    id: str = Field(default_factory=generate_id)
    role: str
    content: str
    created_at: datetime = Field(default_factory=get_current_timestamp)


class MessageCreate(BaseModel):
    """创建消息请求"""

    role: str = "user"
    content: str


# ============ 会话相关 ============

class Session(BaseModel):
    """会话模型"""

    id: str = Field(default_factory=generate_id)
    title: str = "New Chat"
    messages: list[Message] = Field(default_factory=list)
    is_pinned: bool = False
    created_at: datetime = Field(default_factory=get_current_timestamp)
    updated_at: datetime = Field(default_factory=get_current_timestamp)

    def add_message(self, message: Message) -> None:
        """添加消息到会话"""
        self.messages.append(message)
        self.updated_at = get_current_timestamp()


class SessionCreate(BaseModel):
    """创建会话请求"""

    title: Optional[str] = "New Chat"


class SessionResponse(BaseModel):
    """会话响应"""

    id: str
    title: str
    is_pinned: bool = False
    created_at: datetime
    updated_at: datetime
    message_count: int = 0


class SessionDetailResponse(SessionResponse):
    """会话详情响应"""

    messages: list[Message] = Field(default_factory=list)


# ============ 聊天补全相关 ============

class ChatCompletionRequest(BaseModel):
    """聊天补全请求"""

    message: str = Field(..., min_length=1, description="用户消息内容")
    session_id: Optional[str] = Field(None, description="会话 ID，不传则创建新会话")
    stream: bool = Field(False, description="是否使用流式响应")
    model: Optional[str] = Field(None, description="指定模型，不传则使用默认模型")
    agent_id: Optional[str] = Field(None, description="Agent ID，用于设定 AI 角色")
    rule_ids: Optional[list[str]] = Field(None, description="启用的规则 ID 列表")
    # 新增参数
    attachment_ids: Optional[list[str]] = Field(None, description="附件 ID 列表")
    web_search: bool = Field(False, description="是否启用联网搜索")
    thinking: bool = Field(False, description="是否显示思考过程")


class ChatCompletionResponse(BaseModel):
    """聊天补全响应（非流式）"""

    session_id: str
    message_id: str
    role: str = "assistant"
    content: str
    created_at: datetime = Field(default_factory=get_current_timestamp)
