from fastapi import APIRouter

from app.api.v1.agent import router as agent_router
from app.api.v1.chat import router as chat_router
from app.api.v1.memory import router as memory_router
from app.api.v1.rule import router as rule_router
from app.api.v1.upload import router as upload_router

router = APIRouter()

# 注册聊天路由（chat_router 已包含 prefix="/chat"）
router.include_router(chat_router)
# 注册 Agent 路由
router.include_router(agent_router)
# 注册规则路由
router.include_router(rule_router)
# 注册记忆路由
router.include_router(memory_router)
# 注册文件上传路由
router.include_router(upload_router)
