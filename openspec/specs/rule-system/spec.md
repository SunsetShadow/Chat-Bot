# 规则系统规范

## 概述

规则系统允许用户为 AI 添加行为约束、格式要求和输出规则。规则可以在聊天时动态启用或禁用。

## 数据模型

```typescript
interface Rule {
  id: string
  name: string
  description: string
  content: string  // 规则内容，会注入到系统提示词
  category: 'behavior' | 'format' | 'constraint'
  is_enabled: boolean
  created_at: string
  updated_at: string
}
```

## 规则类别

| 类别 | 描述 |
|------|------|
| `behavior` | 行为规则 - 控制 AI 的行为模式 |
| `format` | 格式规则 - 控制输出的格式要求 |
| `constraint` | 约束规则 - 限制 AI 的行为边界 |

## API 端点

- `GET /api/v1/rules` - 获取所有规则
- `GET /api/v1/rules/{id}` - 获取特定规则
- `POST /api/v1/rules` - 创建新规则
- `PUT /api/v1/rules/{id}` - 更新规则
- `DELETE /api/v1/rules/{id}` - 删除规则

## 功能要求

1. **预设规则**: 系统提供常用的规则模板
2. **分类管理**: 规则按类别组织
3. **动态启用**: 用户可以在聊天时选择启用的规则
4. **提示词注入**: 启用的规则会在聊天时注入到系统提示词

## 关键文件

| 路径 | 用途 |
|------|------|
| `frontend/src/stores/rules.ts` | 规则状态管理 |
| `frontend/src/api/rules.ts` | 规则 API 调用 |
| `backend/app/api/v1/rules.py` | 规则 API 路由 |
| `backend/app/services/rule_service.py` | 规则业务逻辑 |

## 约束

1. 规则内容需要有明确的格式要求
2. 规则应该简洁明了，避免过长
3. 默认规则不可删除，但可以禁用
