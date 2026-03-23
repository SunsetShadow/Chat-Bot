from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query

from app.schemas.base import DataResponse
from app.schemas.memory import MemoryCreate, MemoryType, MemoryUpdate
from app.services.memory_service import MemoryService, get_memory_service

router = APIRouter(prefix="/memories", tags=["Memories"])

MemoryServiceDep = Annotated[MemoryService, Depends(get_memory_service)]


@router.get("", response_model=DataResponse)
async def list_memories(
    service: MemoryServiceDep,
    type: Optional[MemoryType] = Query(None, description="按类型过滤"),
    min_importance: int = Query(1, ge=1, le=10, description="最小重要程度"),
):
    """
    获取记忆列表

    - **type**: 记忆类型过滤 (fact/preference/event)
    - **min_importance**: 最小重要程度 (1-10)
    """
    memories = service.list_memories(memory_type=type, min_importance=min_importance)
    return DataResponse(data=memories)


@router.post("", response_model=DataResponse)
async def create_memory(request: MemoryCreate, service: MemoryServiceDep):
    """
    手动创建记忆

    - **content**: 记忆内容
    - **type**: 记忆类型 (fact/preference/event)
    - **source_session_id**: 来源会话 ID
    - **importance**: 重要程度 (1-10)
    """
    memory = service.create_memory(request)
    return DataResponse(data=service.memory_to_response(memory))


@router.get("/{memory_id}", response_model=DataResponse)
async def get_memory(memory_id: str, service: MemoryServiceDep):
    """
    获取记忆详情
    """
    memory = service.get_memory(memory_id)
    return DataResponse(data=service.memory_to_response(memory))


@router.put("/{memory_id}", response_model=DataResponse)
async def update_memory(
    memory_id: str,
    request: MemoryUpdate,
    service: MemoryServiceDep,
):
    """
    更新记忆
    """
    memory = service.update_memory(memory_id, request)
    return DataResponse(data=service.memory_to_response(memory))


@router.delete("/{memory_id}")
async def delete_memory(memory_id: str, service: MemoryServiceDep):
    """
    删除记忆
    """
    service.delete_memory(memory_id)
    return DataResponse(message="Memory deleted successfully")
