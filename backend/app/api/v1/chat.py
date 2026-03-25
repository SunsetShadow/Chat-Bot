from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request
from pydantic import BaseModel, Field

from app.middleware.security import (
    chat_limiter,
    check_rate_limit,
    validate_chat_input,
)
from app.schemas.base import DataResponse, PaginatedResponse, PaginationMeta
from app.schemas.chat import (
    ChatCompletionRequest,
    ChatCompletionResponse,
    SessionCreate,
    SessionDetailResponse,
    SessionResponse,
)
from app.services.chat_service import ChatService, get_chat_service
from app.utils.sse import SSEStreamingResponse

router = APIRouter(prefix="/chat", tags=["Chat"])

# 服务依赖类型
ChatServiceDep = Annotated[ChatService, Depends(get_chat_service)]


@router.post("/completions")
async def chat_completions(
    request: ChatCompletionRequest,
    service: ChatServiceDep,
    http_request: Request,
):
    """
    聊天补全接口

    - **message**: 用户消息内容
    - **session_id**: 会话 ID（可选，不传则创建新会话）
    - **stream**: 是否使用流式响应
    - **model**: 指定模型（可选）
    """
    # 速率限制
    client_ip = http_request.client.host if http_request.client else "unknown"
    check_rate_limit(chat_limiter, f"chat:{client_ip}")

    # 输入验证
    validate_chat_input(request.message)

    if request.stream:
        return SSEStreamingResponse(service.chat_stream(request))
    else:
        result = await service.chat(request)
        return DataResponse(data=result)


@router.post("/sessions", response_model=DataResponse)
async def create_session(
    request: SessionCreate,
    service: ChatServiceDep,
):
    """
    创建新会话

    - **title**: 会话标题（可选）
    """
    session = service.create_session(request)
    return DataResponse(data=service.session_to_response(session))


@router.get("/sessions", response_model=PaginatedResponse)
async def list_sessions(
    service: ChatServiceDep,
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
):
    """
    获取会话列表
    """
    sessions, total = service.list_sessions(page, page_size)
    session_responses = [service.session_to_response(s) for s in sessions]

    total_pages = (total + page_size - 1) // page_size
    return PaginatedResponse(
        data=session_responses,
        pagination=PaginationMeta(
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        ),
    )


@router.get("/sessions/{session_id}", response_model=DataResponse)
async def get_session(
    session_id: str,
    service: ChatServiceDep,
):
    """
    获取会话详情（包含消息列表）
    """
    session = service.get_session(session_id)
    return DataResponse(data=service.session_to_detail_response(session))



class PinSessionRequest(BaseModel):
    """置顶请求"""
    is_pinned: bool = Field(..., description="是否置顶")


@router.put("/sessions/{session_id}/pin", response_model=DataResponse)
async def toggle_session_pin(
    session_id: str,
    request: PinSessionRequest,
    service: ChatServiceDep,
):
    """
    切换会话置顶状态
    """
    session = service.toggle_pin(session_id, request.is_pinned)
    return DataResponse(data=service.session_to_response(session))


@router.get("/sessions/{session_id}/messages", response_model=DataResponse)
async def get_session_messages(
    session_id: str,
    service: ChatServiceDep,
):
    """
    获取会话消息列表
    """
    session = service.get_session(session_id)
    return DataResponse(data=session.messages)
