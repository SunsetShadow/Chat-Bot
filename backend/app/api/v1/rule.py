from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.schemas.base import DataResponse
from app.schemas.rule import RuleCreate, RuleUpdate
from app.services.rule_service import RuleService, get_rule_service

router = APIRouter(prefix="/rules", tags=["Rules"])

RuleServiceDep = Annotated[RuleService, Depends(get_rule_service)]


@router.get("", response_model=DataResponse)
async def list_rules(
    service: RuleServiceDep,
    enabled_only: bool = Query(False, description="只返回启用的规则"),
):
    """
    获取所有规则列表

    返回预设规则和用户创建的自定义规则
    """
    rules = service.list_rules(enabled_only=enabled_only)
    return DataResponse(data=rules)


@router.post("", response_model=DataResponse)
async def create_rule(request: RuleCreate, service: RuleServiceDep):
    """
    创建自定义规则

    - **name**: 规则名称
    - **content**: 规则内容
    - **category**: 规则类别 (behavior/format/constraint)
    """
    rule = service.create_rule(request)
    return DataResponse(data=service.rule_to_response(rule))


@router.get("/{rule_id}", response_model=DataResponse)
async def get_rule(rule_id: str, service: RuleServiceDep):
    """
    获取规则详情
    """
    rule = service.get_rule(rule_id)
    return DataResponse(data=service.rule_to_response(rule))


@router.put("/{rule_id}", response_model=DataResponse)
async def update_rule(
    rule_id: str,
    request: RuleUpdate,
    service: RuleServiceDep,
):
    """
    更新规则

    注意：内置规则只能修改 enabled 状态
    """
    rule = service.update_rule(rule_id, request)
    return DataResponse(data=service.rule_to_response(rule))


@router.delete("/{rule_id}")
async def delete_rule(rule_id: str, service: RuleServiceDep):
    """
    删除规则

    注意：内置规则不允许删除
    """
    service.delete_rule(rule_id)
    return DataResponse(message="Rule deleted successfully")
