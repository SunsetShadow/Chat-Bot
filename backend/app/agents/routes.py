from typing import Annotated

from fastapi import APIRouter, Depends

from app.agents.schemas import AgentCreate, AgentResponse, AgentUpdate
from app.schemas.base import DataResponse
from app.agents.service import AgentService, get_agent_service

router = APIRouter(prefix="/agents", tags=["Agents"])

AgentServiceDep = Annotated[AgentService, Depends(get_agent_service)]


@router.get("", response_model=DataResponse)
async def list_agents(service: AgentServiceDep):
    """
    获取所有 Agent 列表

    返回内置 Agent 和用户创建的自定义 Agent
    """
    agents = service.list_agents()
    return DataResponse(data=agents)


@router.post("", response_model=DataResponse)
async def create_agent(request: AgentCreate, service: AgentServiceDep):
    """
    创建自定义 Agent

    - **name**: Agent 名称
    - **description**: 描述
    - **system_prompt**: 系统提示词
    - **traits**: 特征标签列表
    """
    agent = service.create_agent(request)
    return DataResponse(data=service.agent_to_response(agent))


@router.get("/{agent_id}", response_model=DataResponse)
async def get_agent(agent_id: str, service: AgentServiceDep):
    """
    获取 Agent 详情
    """
    agent = service.get_agent(agent_id)
    return DataResponse(data=service.agent_to_response(agent))


@router.put("/{agent_id}", response_model=DataResponse)
async def update_agent(
    agent_id: str,
    request: AgentUpdate,
    service: AgentServiceDep,
):
    """
    更新 Agent

    注意：内置 Agent 不允许修改
    """
    agent = service.update_agent(agent_id, request)
    return DataResponse(data=service.agent_to_response(agent))


@router.delete("/{agent_id}")
async def delete_agent(agent_id: str, service: AgentServiceDep):
    """
    删除 Agent

    注意：内置 Agent 不允许删除
    """
    service.delete_agent(agent_id)
    return DataResponse(message="Agent deleted successfully")
