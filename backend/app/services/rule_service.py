from functools import lru_cache

from app.core.exceptions import ValidationException, raise_not_found
from app.schemas.base import get_current_timestamp
from app.schemas.rule import Rule, RuleCreate, RuleResponse, RuleUpdate, BUILTIN_RULES


class RuleService:
    """规则服务"""

    def __init__(self):
        # 初始化预设规则和自定义规则存储
        self._rules: dict[str, Rule] = {rule.id: rule.model_copy() for rule in BUILTIN_RULES}

    def list_rules(self, enabled_only: bool = False) -> list[RuleResponse]:
        """获取所有规则"""
        rules = list(self._rules.values())
        if enabled_only:
            rules = [r for r in rules if r.enabled]
        return [
            RuleResponse(
                id=rule.id,
                name=rule.name,
                content=rule.content,
                enabled=rule.enabled,
                category=rule.category,
                is_builtin=rule.is_builtin,
                created_at=rule.created_at,
                updated_at=rule.updated_at,
            )
            for rule in rules
        ]

    def get_rule(self, rule_id: str) -> Rule:
        """获取单个规则"""
        if rule_id not in self._rules:
            raise_not_found("Rule", rule_id)
        return self._rules[rule_id]

    def create_rule(self, request: RuleCreate) -> Rule:
        """创建自定义规则"""
        rule = Rule(
            name=request.name,
            content=request.content,
            category=request.category,
            is_builtin=False,
        )
        self._rules[rule.id] = rule
        return rule

    def update_rule(self, rule_id: str, request: RuleUpdate) -> Rule:
        """更新规则"""
        rule = self.get_rule(rule_id)

        if rule.is_builtin:
            # 内置规则只能修改 enabled 状态
            if request.enabled is not None:
                rule.enabled = request.enabled
        else:
            if request.name is not None:
                rule.name = request.name
            if request.content is not None:
                rule.content = request.content
            if request.enabled is not None:
                rule.enabled = request.enabled
            if request.category is not None:
                rule.category = request.category

        rule.updated_at = get_current_timestamp()
        return rule

    def delete_rule(self, rule_id: str) -> bool:
        """删除规则"""
        rule = self.get_rule(rule_id)

        if rule.is_builtin:
            raise ValidationException("Cannot delete builtin rule")

        del self._rules[rule_id]
        return True

    def get_enabled_rules_content(self) -> list[str]:
        """获取所有启用的规则内容"""
        return [rule.content for rule in self._rules.values() if rule.enabled]

    def rule_to_response(self, rule: Rule) -> RuleResponse:
        """将 Rule 转换为响应格式"""
        return RuleResponse(
            id=rule.id,
            name=rule.name,
            content=rule.content,
            enabled=rule.enabled,
            category=rule.category,
            is_builtin=rule.is_builtin,
            created_at=rule.created_at,
            updated_at=rule.updated_at,
        )


# 服务依赖注入
@lru_cache
def get_rule_service() -> RuleService:
    """获取 RuleService 实例（单例）"""
    return RuleService()
