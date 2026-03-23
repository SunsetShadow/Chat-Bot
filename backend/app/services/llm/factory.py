from typing import Optional

from app.core.config import settings
from app.core.exceptions import LLMException
from app.services.llm.base import BaseLLMProvider
from app.services.llm.openai_provider import OpenAIProvider


class LLMFactory:
    """LLM 提供商工厂类"""

    _providers: dict[str, type[BaseLLMProvider]] = {
        "openai": OpenAIProvider,
    }

    _instances: dict[str, BaseLLMProvider] = {}

    @classmethod
    def register_provider(cls, name: str, provider_class: type[BaseLLMProvider]) -> None:
        """
        注册新的 LLM 提供商

        Args:
            name: 提供商名称
            provider_class: 提供商类
        """
        cls._providers[name.lower()] = provider_class

    @classmethod
    def get_provider(
        cls,
        provider_name: Optional[str] = None,
        **kwargs,
    ) -> BaseLLMProvider:
        """
        获取 LLM 提供商实例

        Args:
            provider_name: 提供商名称，默认为 "openai"
            **kwargs: 传递给提供商构造函数的参数

        Returns:
            BaseLLMProvider 实例
        """
        name = (provider_name or "openai").lower()

        if name not in cls._providers:
            raise LLMException(f"Unknown LLM provider: {name}")

        # 使用缓存的单例实例（除非提供了自定义参数）
        cache_key = f"{name}:{hash(frozenset(kwargs.items()))}"
        if cache_key not in cls._instances:
            provider_class = cls._providers[name]
            cls._instances[cache_key] = provider_class(**kwargs)

        return cls._instances[cache_key]

    @classmethod
    def create_provider(cls, provider_name: Optional[str] = None, **kwargs) -> BaseLLMProvider:
        """
        创建新的 LLM 提供商实例（不使用缓存）

        Args:
            provider_name: 提供商名称
            **kwargs: 传递给提供商构造函数的参数

        Returns:
            新的 BaseLLMProvider 实例
        """
        name = (provider_name or "openai").lower()

        if name not in cls._providers:
            raise LLMException(f"Unknown LLM provider: {name}")

        provider_class = cls._providers[name]
        return provider_class(**kwargs)

    @classmethod
    def list_providers(cls) -> list[str]:
        """
        列出所有已注册的提供商

        Returns:
            提供商名称列表
        """
        return list(cls._providers.keys())


def get_default_llm_provider() -> BaseLLMProvider:
    """获取默认的 LLM 提供商"""
    return LLMFactory.get_provider("openai")
