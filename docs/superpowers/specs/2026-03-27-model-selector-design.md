# 模型选择器功能设计规范

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在用户输入框上方添加模型切换功能，支持每个会话独立选择模型

**Architecture:** 前端新建 ModelSelector 组件 + model store，后端新增 /models API

**Tech Stack:** Vue 3 + Naive UI + Pinia + FastAPI

---

## 文件结构

| 文件 | 变更 | 说明 |
|------|------|------|
| `frontend/src/stores/model.ts` | 新建 | 模型状态管理 |
| `frontend/src/components/chat/ModelSelector.vue` | 新建 | 模型选择器组件 |
| `frontend/src/components/chat/MessageInput.vue` | 修改 | 集成 ModelSelector |
| `frontend/src/composables/useChatStream.ts` | 修改 | 发送时附带 model 参数 |
| `backend/app/api/v1/model.py` | 新建 | 模型列表 API |
| `backend/app/api/v1/router.py` | 修改 | 注册模型路由 |

---

## Task 1: 创建后端模型 API

**Files:**
- Create: `backend/app/api/v1/model.py`
- Modify: `backend/app/api/v1/router.py`

### Step 1.1: 创建模型 API 文件

```python
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


# 预定义的模型列表
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
    """获取可用模型列表"""
    return ModelsResponse(models=AVAILABLE_MODELS)
```

### Step 1.2: 注册路由

在 `router.py` 中添加：
```python
from app.api.v1.model import router as model_router
# ...
router.include_router(model_router)
```

### Step 1.3: 验证 API

Run: `curl http://localhost:8000/api/models`
Expected: 返回模型列表 JSON

---

## Task 2: 创建前端 model store

**Files:**
- Create: `frontend/src/stores/model.ts`

### Step 2.1: 创建 store 文件

（已创建，内容见现有文件）

### Step 2.2: 验证 store 导入

Run: `pnpm build`
Expected: 无错误

---

## Task 3: 创建 ModelSelector 组件

**Files:**
- Create: `frontend/src/components/chat/ModelSelector.vue`

### Step 3.1: 创建组件

（已创建，内容见现有文件）

### Step 3.2: 验证组件构建

Run: `pnpm build`
Expected: 无错误

---

## Task 4: 集成到 MessageInput

**Files:**
- Modify: `frontend/src/components/chat/MessageInput.vue`

### Step 4.1: 导入并使用组件

（已完成集成）

### Step 4.2: 验证集成

Run: `pnpm build`
Expected: 无错误

---

## Task 5: 更新 useChatStream 传递 model 参数

**Files:**
- Modify: `frontend/src/composables/useChatStream.ts`

### Step 5.1: 更新接口和请求

（已更新，model 参数已添加到 SendMessageOptions 和请求中）

### Step 5.2: 验证类型检查

Run: `pnpm build`
Expected: 无错误

---

## 验收标准

- [ ] GET /api/models 返回模型列表
- [ ] 模型选择器显示在输入框上方
- [ ] 点击可选择不同模型
- [ ] 选择后显示当前模型名称
- [ ] 发送消息时 model 参数被传递
- [ ] 亮色/暗色模式下样式正常
- [ ] 无 TypeScript 错误
- [ ] 无 lint 错误
