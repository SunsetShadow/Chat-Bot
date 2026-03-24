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

## 记忆检索策略

### 相关性评分

```typescript
interface MemoryRetrievalConfig {
  max_memories: number      // 每次检索最大数量，默认 10
  min_relevance: number     // 最低相关性阈值，默认 0.5
  recency_weight: number    // 时效性权重，默认 0.3
  type_weights: {
    fact: number            // 事实权重，默认 0.4
    preference: number      // 偏好权重，默认 0.4
    event: number           // 事件权重，默认 0.2
  }
}
```

### 检索流程

```
用户消息 → 语义向量化 → 相似度计算 → 时效性加权 → 排序 → 返回 Top-N
```

### 记忆过期机制

```typescript
interface MemoryTTL {
  fact: number       // 事实：永不过期 (0)
  preference: number // 偏好：30 天
  event: number      // 事件：7 天
}

// 过期记忆自动降权，不删除
// 用户可手动标记"重要"永久保留
```

## 约束

1. 记忆提取是异步进行的，不阻塞聊天响应
2. 低置信度的记忆应该被过滤
3. 敏感信息不应被存储为记忆
4. 记忆应该定期清理过时或不再相关的内容
5. 每次对话注入的记忆不超过 10 条
6. 事件类型记忆默认 7 天后过期
