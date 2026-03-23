import json
from functools import lru_cache
from typing import Optional

from app.core.exceptions import raise_not_found
from app.schemas.base import get_current_timestamp
from app.schemas.memory import Memory, MemoryCreate, MemoryResponse, MemoryType, MemoryUpdate
from app.services.llm.factory import get_default_llm_provider


class MemoryService:
    """记忆服务"""

    def __init__(self):
        # 内存存储记忆
        self._memories: dict[str, Memory] = {}

    def list_memories(
        self,
        memory_type: Optional[MemoryType] = None,
        min_importance: int = 1,
    ) -> list[MemoryResponse]:
        """获取记忆列表"""
        memories = list(self._memories.values())

        if memory_type:
            memories = [m for m in memories if m.type == memory_type]
        if min_importance > 1:
            memories = [m for m in memories if m.importance >= min_importance]

        # 按重要性和最后访问时间排序
        memories.sort(key=lambda m: (-m.importance, m.last_accessed), reverse=True)

        return [
            MemoryResponse(
                id=m.id,
                content=m.content,
                type=m.type,
                source_session_id=m.source_session_id,
                importance=m.importance,
                created_at=m.created_at,
                last_accessed=m.last_accessed,
            )
            for m in memories
        ]

    def get_memory(self, memory_id: str) -> Memory:
        """获取单个记忆"""
        if memory_id not in self._memories:
            raise_not_found("Memory", memory_id)
        return self._memories[memory_id]

    def create_memory(self, request: MemoryCreate) -> Memory:
        """手动创建记忆"""
        memory = Memory(
            content=request.content,
            type=request.type,
            source_session_id=request.source_session_id,
            importance=request.importance,
        )
        self._memories[memory.id] = memory
        return memory

    def update_memory(self, memory_id: str, request: MemoryUpdate) -> Memory:
        """更新记忆"""
        memory = self.get_memory(memory_id)

        if request.content is not None:
            memory.content = request.content
        if request.type is not None:
            memory.type = request.type
        if request.importance is not None:
            memory.importance = request.importance

        memory.last_accessed = get_current_timestamp()
        return memory

    def delete_memory(self, memory_id: str) -> bool:
        """删除记忆"""
        self.get_memory(memory_id)  # 检查是否存在
        del self._memories[memory_id]
        return True

    async def extract_memory_from_conversation(
        self,
        user_message: str,
        assistant_message: str,
        session_id: str,
    ) -> Optional[Memory]:
        """
        从对话中自动提取记忆

        使用 LLM 分析对话内容，提取重要信息作为长期记忆
        """
        prompt = f"""请分析以下对话，判断是否包含需要记住的重要信息。

用户消息: {user_message}
助手回复: {assistant_message}

如果有重要信息（如用户的偏好、事实、重要事件），请按以下 JSON 格式返回：
{{"has_memory": true, "type": "fact/preference/event", "content": "记忆内容", "importance": 1-10}}

如果没有需要记住的信息，返回：
{{"has_memory": false}}

只返回 JSON，不要其他内容。"""

        try:
            llm = get_default_llm_provider()
            response = await llm.chat([{"role": "user", "content": prompt}])

            result = json.loads(response.content.strip())

            if result.get("has_memory"):
                memory_type = MemoryType(result.get("type", "fact"))
                memory = Memory(
                    content=result["content"],
                    type=memory_type,
                    source_session_id=session_id,
                    importance=result.get("importance", 5),
                )
                self._memories[memory.id] = memory
                return memory

        except (json.JSONDecodeError, ValueError, KeyError):
            pass

        return None

    def get_relevant_memories(self, query: str, limit: int = 5) -> list[Memory]:
        """获取与查询相关的记忆（简单实现：返回所有记忆）"""
        # TODO: 实现基于语义相似度的记忆检索
        memories = sorted(
            self._memories.values(),
            key=lambda m: (-m.importance, m.last_accessed),
        )
        return memories[:limit]

    def get_memory_context(self) -> str:
        """获取记忆上下文，用于注入到系统提示词"""
        if not self._memories:
            return ""

        memories = self.get_relevant_memories("", limit=10)
        if not memories:
            return ""

        context_parts = ["以下是关于用户的已知信息："]
        for m in memories:
            type_label = {"fact": "事实", "preference": "偏好", "event": "事件"}
            context_parts.append(f"- [{type_label.get(m.type, '信息')}] {m.content}")

        return "\n".join(context_parts)

    def memory_to_response(self, memory: Memory) -> MemoryResponse:
        """将 Memory 转换为响应格式"""
        return MemoryResponse(
            id=memory.id,
            content=memory.content,
            type=memory.type,
            source_session_id=memory.source_session_id,
            importance=memory.importance,
            created_at=memory.created_at,
            last_accessed=memory.last_accessed,
        )


# 服务依赖注入
@lru_cache
def get_memory_service() -> MemoryService:
    """获取 MemoryService 实例（单例）"""
    return MemoryService()
