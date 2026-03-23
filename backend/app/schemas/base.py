from datetime import datetime
from typing import Any
from uuid import uuid4

from pydantic import BaseModel, Field


def generate_id() -> str:
    """生成唯一 ID"""
    return str(uuid4())


def get_current_timestamp() -> datetime:
    """获取当前时间戳"""
    return datetime.now()


class BaseResponse(BaseModel):
    """基础响应模式"""

    success: bool = True
    message: str = "Success"
    code: str = "SUCCESS"


class DataResponse(BaseResponse):
    """带数据的响应模式"""

    data: Any = None


class PaginationMeta(BaseModel):
    """分页元数据"""

    total: int = 0
    page: int = 1
    page_size: int = 20
    total_pages: int = 0


class PaginatedResponse(BaseResponse):
    """分页响应模式"""

    data: list[Any] = Field(default_factory=list)
    pagination: PaginationMeta = Field(default_factory=PaginationMeta)
