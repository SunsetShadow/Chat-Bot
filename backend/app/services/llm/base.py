from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncIterator, Optional


@dataclass
class LLMResponse:
    """LLM 非流式响应"""

    content: str
    finish_reason: str = "stop"
    usage: Optional[dict] = None


@dataclass
class StreamChunk:
    """LLM 流式响应块"""

    content: str
    finish_reason: Optional[str] = None


class BaseLLMProvider(ABC):
    """LLM 提供商抽象基类"""

    @abstractmethod
    async def chat(self, messages: list[dict], **kwargs) -> LLMResponse:
        """
        非流式聊天

        Args:
            messages: 消息列表，格式为 [{"role": "user", "content": "..."}]
            **kwargs: 额外参数（temperature, max_tokens 等）

        Returns:
            LLMResponse: LLM 响应
        """
        pass

    @abstractmethod
    async def chat_stream(self, messages: list[dict], **kwargs) -> AsyncIterator[StreamChunk]:
        """
        流式聊天

        Args:
            messages: 消息列表，格式为 [{"role": "user", "content": "..."}]
            **kwargs: 额外参数（temperature, max_tokens 等）

        Yields:
            StreamChunk: 流式响应块
        """
        pass

    def _build_messages(self, system_prompt: Optional[str], messages: list[dict]) -> list[dict]:
        """
        构建完整的消息列表

        Args:
            system_prompt: 系统提示词
            messages: 用户消息列表

        Returns:
            完整的消息列表
        """
        result = []
        if system_prompt:
            result.append({"role": "system", "content": system_prompt})
        result.extend(messages)
        return result
