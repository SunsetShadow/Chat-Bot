from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field

from app.schemas.base import generate_id, get_current_timestamp


class RuleCategory(str, Enum):
    """规则类别"""

    BEHAVIOR = "behavior"
    FORMAT = "format"
    CONSTRAINT = "constraint"


class ConflictStrategy(str, Enum):
    """冲突处理策略"""

    OVERRIDE = "override"  # 高优先级覆盖低优先级
    MERGE = "merge"  # 合并所有规则内容
    REJECT = "reject"  # 检测到冲突时拒绝启用


class Rule(BaseModel):
    """规则模型"""

    id: str = Field(default_factory=generate_id)
    name: str
    content: str
    enabled: bool = True
    category: RuleCategory = RuleCategory.FORMAT
    priority: int = Field(default=5, ge=1, le=10, description="优先级 1-10，数值越高优先级越高")
    conflict_strategy: ConflictStrategy = ConflictStrategy.MERGE
    is_builtin: bool = False
    created_at: datetime = Field(default_factory=get_current_timestamp)
    updated_at: datetime = Field(default_factory=get_current_timestamp)


class RuleCreate(BaseModel):
    """创建规则请求"""

    name: str = Field(..., min_length=1, max_length=100)
    content: str = Field(..., min_length=1, max_length=1000)
    category: RuleCategory = RuleCategory.FORMAT


class RuleUpdate(BaseModel):
    """更新规则请求"""

    name: Optional[str] = Field(None, min_length=1, max_length=100)
    content: Optional[str] = Field(None, min_length=1, max_length=1000)
    enabled: Optional[bool] = None
    category: Optional[RuleCategory] = None
    priority: Optional[int] = Field(None, ge=1, le=10)
    conflict_strategy: Optional[ConflictStrategy] = None


class RuleResponse(BaseModel):
    """规则响应"""

    id: str
    name: str
    content: str
    enabled: bool
    category: RuleCategory
    priority: int
    conflict_strategy: ConflictStrategy
    is_builtin: bool
    created_at: datetime
    updated_at: datetime


# 预设规则数据
BUILTIN_RULES: list[Rule] = [
    Rule(
        id="builtin-concise",
        name="简洁回复",
        content="请保持回答简洁明了，避免冗长的解释。",
        enabled=True,
        category=RuleCategory.FORMAT,
        priority=5,
        conflict_strategy=ConflictStrategy.MERGE,
        is_builtin=True,
    ),
    Rule(
        id="builtin-detailed",
        name="详细解释",
        content="请提供详细的解释和示例，帮助用户深入理解。",
        enabled=False,
        category=RuleCategory.FORMAT,
        priority=5,
        conflict_strategy=ConflictStrategy.MERGE,
        is_builtin=True,
    ),
    Rule(
        id="builtin-polite",
        name="礼貌用语",
        content="使用礼貌、专业的语言与用户交流。",
        enabled=True,
        category=RuleCategory.BEHAVIOR,
        priority=6,
        conflict_strategy=ConflictStrategy.MERGE,
        is_builtin=True,
    ),
    Rule(
        id="builtin-no-emoji",
        name="不用表情",
        content="不要使用表情符号，保持正式的回复风格。",
        enabled=False,
        category=RuleCategory.CONSTRAINT,
        priority=7,
        conflict_strategy=ConflictStrategy.OVERRIDE,
        is_builtin=True,
    ),
    Rule(
        id="builtin-code-highlight",
        name="代码高亮",
        content="代码块请使用正确的语法高亮标记语言类型。",
        enabled=True,
        category=RuleCategory.FORMAT,
        priority=5,
        conflict_strategy=ConflictStrategy.MERGE,
        is_builtin=True,
    ),
]
