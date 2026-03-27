"""Model API - 获取可用模型列表"""

from fastapi import APIRouter
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/models", tags=["Models"])


class ModelInfo(BaseModel):
    """模型信息"""

    id: str
    name: str
    provider: str
    available: bool = True
    context_length: Optional[int] = None
    description: Optional[str] = None


class ModelsResponse(BaseModel):
    """模型列表响应"""

    models: list[ModelInfo]


# 预定义的模型列表（可以从配置或数据库加载）
AVAILABLE_MODELS = [
    # OpenAI 模型
    ModelInfo(
        id="gpt-4o",
        name="GPT-4o",
        provider="openai",
        available=True,
        context_length=128000,
        description="最新多模态模型，速度快且智能",
    ),
    ModelInfo(
        id="gpt-4o-mini",
        name="GPT-4o Mini",
        provider="openai",
        available=True,
        context_length=128000,
        description="轻量级模型，适合日常对话",
    ),
    ModelInfo(
        id="gpt-4-turbo",
        name="GPT-4 Turbo",
        provider="openai",
        available=True,
        context_length=128000,
        description="高性能推理模型",
    ),
    ModelInfo(
        id="gpt-3.5-turbo",
        name="GPT-3.5 Turbo",
        provider="openai",
        available=True,
        context_length=16385,
        description="经济高效的选择",
    ),
    ModelInfo(
        id="o1-preview",
        name="O1 Preview",
        provider="openai",
        available=True,
        context_length=128000,
        description="高级推理模型",
    ),
    ModelInfo(
        id="o1-mini",
        name="O1 Mini",
        provider="openai",
        available=True,
        context_length=128000,
        description="轻量级推理模型",
    ),
    # Anthropic 模型
    ModelInfo(
        id="claude-3-5-sonnet-20241022",
        name="Claude 3.5 Sonnet",
        provider="anthropic",
        available=True,
        context_length=200000,
        description="Anthropic 最新模型",
    ),
    ModelInfo(
        id="claude-3-opus-20240229",
        name="Claude 3 Opus",
        provider="anthropic",
        available=True,
        context_length=200000,
        description="最强推理能力",
    ),
    ModelInfo(
        id="claude-3-sonnet-20240229",
        name="Claude 3 Sonnet",
        provider="anthropic",
        available=True,
        context_length=200000,
        description="平衡性能与速度",
    ),
    ModelInfo(
        id="claude-3-haiku-20240307",
        name="Claude 3 Haiku",
        provider="anthropic",
        available=True,
        context_length=200000,
        description="快速响应模型",
    ),
    # Google 模型
    ModelInfo(
        id="gemini-1.5-pro",
        name="Gemini 1.5 Pro",
        provider="google",
        available=True,
        context_length=1000000,
        description="Google 超长上下文模型",
    ),
    ModelInfo(
        id="gemini-1.5-flash",
        name="Gemini 1.5 Flash",
        provider="google",
        available=True,
        context_length=1000000,
        description="Google 快速响应模型",
    ),
]


@router.get("", response_model=ModelsResponse)
async def get_models():
    """
    获取可用模型列表

    Returns:
        ModelsResponse: 包含所有可用模型的列表
    """
    return ModelsResponse(models=AVAILABLE_MODELS)
