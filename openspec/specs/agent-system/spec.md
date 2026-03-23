# Agent 系统规范

## 概述

Agent 系统允许用户选择不同的 AI 人设角色，每个 Agent 拥有自定义的系统提示词和行为模式。

## 数据模型

```typescript
interface Agent {
  id: string
  name: string
  description: string
  system_prompt: string
  avatar?: string
  is_active: boolean
  created_at: string
  updated_at: string
}
```

## API 端点

- `GET /api/v1/agents` - 获取所有 Agent
- `GET /api/v1/agents/{id}` - 获取特定 Agent
- `POST /api/v1/agents` - 创建新 Agent
- `PUT /api/v1/agents/{id}` - 更新 Agent
- `DELETE /api/v1/agents/{id}` - 删除 Agent

## 功能要求

1. **预设 Agent**: 系统提供预设的 Agent 模板
2. **自定义 Agent**: 用户可以创建自定义 Agent
3. **系统提示词注入**: Agent 的 system_prompt 在聊天时注入到 LLM 上下文

## 关键文件

| 路径 | 用途 |
|------|------|
| `frontend/src/stores/agent.ts` | Agent 状态管理 |
| `frontend/src/api/agent.ts` | Agent API 调用 |
| `backend/app/api/v1/agents.py` | Agent API 路由 |
| `backend/app/services/agent_service.py` | Agent 业务逻辑 |

## 约束

1. 每个 Agent 必须有唯一的名称
2. system_prompt 不能为空
3. 删除 Agent 不影响已有的聊天会话
