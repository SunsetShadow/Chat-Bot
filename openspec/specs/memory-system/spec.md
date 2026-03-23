# 记忆系统规范

## 概述

记忆系统使用 AI 自动从对话中提取重要信息（事实、偏好、事件），并存储为长期记忆，用于增强后续对话的上下文。

## 数据模型

```typescript
interface Memory {
  id: string
  session_id: string
  memory_type: 'fact' | 'preference' | 'event'
  content: string
  confidence: number  // 0.0 - 1.0
  created_at: string
}

interface MemoryExtractionResult {
  memories: Memory[]
  reasoning: string
}
```

## 记忆类型

| 类型 | 描述 | 示例 |
|------|------|------|
| `fact` | 事实信息 | 用户是一位软件工程师 |
| `preference` | 用户偏好 | 用户喜欢使用 TypeScript |
| `event` | 重要事件 | 用户昨天完成了项目上线 |

## API 端点

- `GET /api/v1/memories` - 获取所有记忆
- `GET /api/v1/memories/{id}` - 获取特定记忆
- `DELETE /api/v1/memories/{id}` - 删除记忆

## 功能要求

1. **自动提取**: AI 自动从对话中识别和提取记忆
2. **置信度评分**: 每条记忆有置信度评分
3. **上下文增强**: 记忆会在后续对话中注入到系统提示词
4. **去重**: 避免重复存储相同或相似的记忆

## 关键文件

| 路径 | 用途 |
|------|------|
| `frontend/src/stores/memory.ts` | 记忆状态管理 |
| `backend/app/api/v1/memories.py` | 记忆 API 路由 |
| `backend/app/services/memory_service.py` | AI 驱动的记忆提取 |

## 约束

1. 记忆提取是异步进行的，不阻塞聊天响应
2. 低置信度的记忆应该被过滤
3. 敏感信息不应被存储为记忆
4. 记忆应该定期清理过时或不再相关的内容
