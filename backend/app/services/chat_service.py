import logging
from functools import lru_cache
from typing import AsyncIterator, Optional

logger = logging.getLogger(__name__)

from app.core.exceptions import SessionNotFoundException
from app.schemas.base import generate_id
from app.schemas.chat import (
    ChatCompletionRequest,
    ChatCompletionResponse,
    Message,
    Session,
    SessionCreate,
    SessionDetailResponse,
    SessionResponse,
)
from app.schemas.sse import (
    SSEEventType,
    create_content_delta_event,
    create_done_event,
    create_error_event,
    create_message_done_event,
    create_message_start_event,
)
from app.services.agent_service import AgentService
from app.services.llm.factory import get_default_llm_provider
from app.services.memory_service import MemoryService
from app.services.rule_service import RuleService


class ChatService:
    """聊天服务 - 核心业务逻辑"""

    def __init__(self):
        # 内存存储会话（生产环境应使用数据库）
        self._sessions: dict[str, Session] = {}
        # 集成 Agent、Rule、Memory 服务
        self._agent_service = AgentService()
        self._rule_service = RuleService()
        self._memory_service = MemoryService()

    def _build_system_prompt(
        self,
        agent_id: Optional[str] = None,
        rule_ids: Optional[list[str]] = None,
    ) -> str:
        """构建系统提示词"""
        parts = []

        # 添加 Agent 角色设定
        if agent_id:
            try:
                agent = self._agent_service.get_agent(agent_id)
                parts.append(f"你现在是「{agent.name}」。\n{agent.system_prompt}")
            except Exception as e:
                logger.warning(f"Failed to load agent {agent_id}: {e}")

        # 添加规则
        if rule_ids:
            rules_content = []
            for rule_id in rule_ids:
                try:
                    rule = self._rule_service.get_rule(rule_id)
                    if rule.enabled:
                        rules_content.append(rule.content)
                except Exception as e:
                    logger.warning(f"Failed to load rule {rule_id}: {e}")
            if rules_content:
                parts.append("请遵循以下规则：\n" + "\n".join(f"- {r}" for r in rules_content))

        # 添加记忆上下文
        memory_context = self._memory_service.get_memory_context()
        if memory_context:
            parts.append(memory_context)

        return "\n\n".join(parts) if parts else ""

    def create_session(self, request: SessionCreate) -> Session:
        """
        创建新会话

        Args:
            request: 会话创建请求

        Returns:
            新创建的会话
        """
        session = Session(title=request.title or "New Chat")
        self._sessions[session.id] = session
        return session

    def get_session(self, session_id: str) -> Session:
        """
        获取会话

        Args:
            session_id: 会话 ID

        Returns:
            会话对象

        Raises:
            SessionNotFoundException: 会话不存在
        """
        if session_id not in self._sessions:
            raise SessionNotFoundException(session_id)
        return self._sessions[session_id]

    def list_sessions(self, page: int = 1, page_size: int = 20) -> tuple[list[Session], int]:
        """
        列出会话

        Args:
            page: 页码
            page_size: 每页数量

        Returns:
            (会话列表, 总数)
        """
        sessions = sorted(
            self._sessions.values(),
            key=lambda s: s.updated_at,
            reverse=True,
        )
        total = len(sessions)
        start = (page - 1) * page_size
        end = start + page_size
        return sessions[start:end], total

    def delete_session(self, session_id: str) -> bool:
        """
        删除会话

        Args:
            session_id: 会话 ID

        Returns:
            是否删除成功
        """
        if session_id in self._sessions:
            del self._sessions[session_id]
            return True
        return False

    def session_to_response(self, session: Session) -> SessionResponse:
        """将 Session 转换为 SessionResponse"""
        return SessionResponse(
            id=session.id,
            title=session.title,
            created_at=session.created_at,
            updated_at=session.updated_at,
            message_count=len(session.messages),
        )

    def session_to_detail_response(self, session: Session) -> SessionDetailResponse:
        """将 Session 转换为 SessionDetailResponse"""
        return SessionDetailResponse(
            id=session.id,
            title=session.title,
            created_at=session.created_at,
            updated_at=session.updated_at,
            message_count=len(session.messages),
            messages=session.messages,
        )

    async def chat(self, request: ChatCompletionRequest) -> ChatCompletionResponse:
        """
        非流式聊天

        Args:
            request: 聊天请求

        Returns:
            聊天响应
        """
        # 获取或创建会话
        if request.session_id:
            session = self.get_session(request.session_id)
        else:
            session = self.create_session(SessionCreate())

        # 添加用户消息
        user_message = Message(role="user", content=request.message)
        session.add_message(user_message)

        # 构建 LLM 消息
        messages = [{"role": msg.role, "content": msg.content} for msg in session.messages]

        # 构建系统提示词
        system_prompt = self._build_system_prompt(request.agent_id, request.rule_ids)

        # 调用 LLM
        llm = get_default_llm_provider()
        response = await llm.chat(messages, system_prompt=system_prompt)

        # 添加助手消息
        assistant_message = Message(role="assistant", content=response.content)
        session.add_message(assistant_message)

        # 更新会话标题（如果是第一条用户消息）
        if len(session.messages) == 2:  # 用户消息 + 助手消息
            session.title = request.message[:50] + ("..." if len(request.message) > 50 else "")

        # 尝试提取记忆
        try:
            await self._memory_service.extract_memory_from_conversation(
                request.message, response.content, session.id
            )
        except Exception:
            pass  # 记忆提取失败不影响主流程

        return ChatCompletionResponse(
            session_id=session.id,
            message_id=assistant_message.id,
            role="assistant",
            content=response.content,
        )

    async def chat_stream(self, request: ChatCompletionRequest) -> AsyncIterator[str]:
        """
        流式聊天 - 返回 SSE 格式字符串

        Args:
            request: 聊天请求

        Yields:
            SSE 格式的事件字符串
        """
        message_id = generate_id()
        session_id = request.session_id
        sent_finish = False  # 跟踪是否已发送完成事件

        try:
            # 获取或创建会话
            if session_id:
                try:
                    session = self.get_session(session_id)
                except SessionNotFoundException:
                    yield create_error_event(f"Session {session_id} not found", "SESSION_NOT_FOUND")
                    return
            else:
                session = self.create_session(SessionCreate())
                session_id = session.id

            # 添加用户消息
            user_message = Message(role="user", content=request.message)
            session.add_message(user_message)

            # 发送消息开始事件
            yield create_message_start_event(session_id, message_id)

            # 构建 LLM 消息
            messages = [{"role": msg.role, "content": msg.content} for msg in session.messages]

            # 构建系统提示词
            system_prompt = self._build_system_prompt(request.agent_id, request.rule_ids)

            # 调用 LLM 流式 API
            llm = get_default_llm_provider()
            full_content = ""

            async for chunk in llm.chat_stream(messages, system_prompt=system_prompt):
                if chunk.content:
                    full_content += chunk.content
                    yield create_content_delta_event(session_id, message_id, chunk.content)

                if chunk.finish_reason and not sent_finish:
                    sent_finish = True
                    yield create_message_done_event(session_id, message_id, chunk.finish_reason)

            # 如果没有收到 finish_reason，手动发送完成事件
            if not sent_finish:
                yield create_message_done_event(session_id, message_id, "stop")

            # 添加助手消息到会话
            assistant_message = Message(id=message_id, role="assistant", content=full_content)
            session.add_message(assistant_message)

            # 更新会话标题
            if len(session.messages) == 2:
                session.title = request.message[:50] + ("..." if len(request.message) > 50 else "")

            # 尝试提取记忆
            try:
                await self._memory_service.extract_memory_from_conversation(
                    request.message, full_content, session_id
                )
            except Exception:
                pass  # 记忆提取失败不影响主流程

            # 发送会话完成事件
            yield create_done_event(session_id)

        except Exception as e:
            yield create_error_event(str(e), "CHAT_ERROR", session_id)


# 服务依赖注入
@lru_cache
def get_chat_service() -> ChatService:
    """获取 ChatService 实例（单例）"""
    return ChatService()
