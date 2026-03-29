from functools import lru_cache

from app.agents.prompts import BUILTIN_AGENTS
from app.agents.schemas import Agent, AgentCreate, AgentResponse, AgentUpdate
from app.core.exceptions import ValidationException, raise_not_found


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
