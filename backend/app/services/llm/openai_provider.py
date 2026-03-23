from typing import AsyncIterator, Optional

from openai import AsyncOpenAI

from app.core.config import settings
from app.core.exceptions import LLMException
from app.services.llm.base import BaseLLMProvider, LLMResponse, StreamChunk


class OpenAIProvider(BaseLLMProvider):
    """OpenAI LLM 提供商"""

    def __init__(
        self,
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
    ):
        self.api_key = api_key or settings.openai_api_key
        self.base_url = base_url or settings.openai_base_url or None
        self.model = model or settings.openai_model

        if not self.api_key:
            raise LLMException("OpenAI API key is not configured")

        self.client = AsyncOpenAI(api_key=self.api_key, base_url=self.base_url)

    async def chat(self, messages: list[dict], **kwargs) -> LLMResponse:
        """
        非流式聊天

        Args:
            messages: 消息列表
            **kwargs: 额外参数（temperature, max_tokens, system_prompt 等）

        Returns:
            LLMResponse
        """
        try:
            system_prompt = kwargs.pop("system_prompt", None)
            full_messages = self._build_messages(system_prompt, messages)

            response = await self.client.chat.completions.create(
                model=self.model,
                messages=full_messages,
                stream=False,
                **kwargs,
            )

            choice = response.choices[0]
            return LLMResponse(
                content=choice.message.content or "",
                finish_reason=choice.finish_reason or "stop",
                usage={
                    "prompt_tokens": response.usage.prompt_tokens if response.usage else 0,
                    "completion_tokens": response.usage.completion_tokens if response.usage else 0,
                    "total_tokens": response.usage.total_tokens if response.usage else 0,
                },
            )
        except Exception as e:
            raise LLMException(f"OpenAI API error: {str(e)}")

    async def chat_stream(self, messages: list[dict], **kwargs) -> AsyncIterator[StreamChunk]:
        """
        流式聊天

        Args:
            messages: 消息列表
            **kwargs: 额外参数

        Yields:
            StreamChunk
        """
        try:
            system_prompt = kwargs.pop("system_prompt", None)
            full_messages = self._build_messages(system_prompt, messages)

            stream = await self.client.chat.completions.create(
                model=self.model,
                messages=full_messages,
                stream=True,
                **kwargs,
            )

            async for chunk in stream:
                if chunk.choices and len(chunk.choices) > 0:
                    delta = chunk.choices[0].delta
                    finish_reason = chunk.choices[0].finish_reason

                    content = delta.content or ""
                    if content or finish_reason:
                        yield StreamChunk(
                            content=content,
                            finish_reason=finish_reason,
                        )
        except Exception as e:
            raise LLMException(f"OpenAI streaming error: {str(e)}")
