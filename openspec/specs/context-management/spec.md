# 对话上下文管理规范

## 概述

定义对话上下文的管理策略，包括 Token 限制、消息截断、上下文窗口管理等。

## Token 限制策略

### 模型限制

| 模型 | 上下文窗口 | 建议使用量 |
|------|-----------|-----------|
| GPT-4o | 128K | ≤ 100K |
| GPT-4o-mini | 128K | ≤ 100K |
| GPT-3.5-turbo | 16K | ≤ 12K |

### 分配策略

```
总上下文 = 系统提示词 + 记忆 + 历史消息 + 用户输入 + 响应预留
         └─ 10%      └─ 5%  └─ 60%      └─ 15%    └─ 10%
```

## 消息截断策略

### 滑动窗口

```typescript
interface SlidingWindowConfig {
  max_messages: number       // 最大消息数，默认 50
  max_tokens: number         // 最大 Token 数
  preserve_recent: number    // 保留最近 N 条，默认 10
  preserve_system: boolean   // 保留系统消息
}
```

### 截断算法

```typescript
function truncateMessages(
  messages: Message[],
  config: SlidingWindowConfig
): Message[] {
  // 1. 计算当前 Token 总量
  // 2. 如果超限，从最早的消息开始移除
  // 3. 保留系统消息和最近的 N 条消息
  // 4. 返回截断后的消息列表
}
```

### 消息摘要

当消息过长时，自动对早期消息生成摘要：

```typescript
interface SummaryConfig {
  trigger_threshold: number  // 触发摘要的 Token 阈值
  summary_ratio: number      // 摘要压缩比，默认 0.2
  preserve_turns: number     // 保留完整对话轮次
}
```

## 上下文构建流程

```
1. 加载系统提示词（Agent + Rules）
2. 注入相关记忆
3. 加载历史消息（滑动窗口截断）
4. 添加当前用户输入
5. 检查 Token 限制
6. 如超限，执行摘要或截断
7. 发送到 LLM
```

## Token 计算

```typescript
interface TokenCounter {
  count(text: string): number
  countMessages(messages: Message[]): number
}

// 使用 tiktoken 或模型对应的 tokenizer
```

## 关键文件

| 路径 | 用途 |
|------|------|
| `backend/app/services/context_service.py` | 上下文管理服务 |
| `backend/app/utils/token_counter.py` | Token 计算工具 |

## 约束

1. 系统提示词优先级最高，不可截断
2. 最近 10 条消息必须完整保留
3. 摘要操作异步进行，不阻塞响应
4. Token 超限时优先移除最早的普通消息
5. 保留的消息总数不超过配置的最大值
