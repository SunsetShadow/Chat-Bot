# Ani Supervisor — Avatar + Supervisor 合并设计

**日期**: 2026-04-23
**状态**: Approved

## 概述

将当前无角色的 Supervisor 路由器与 Avatar 系统合并为一个有角色定位的 Agent —— **Ani**。Ani 直接取代超级助手（`builtin-general`），作为 Supervisor 图的核心节点，拥有全部 tools 和 Avatar 控制能力，可直接回答用户问题或调度 Worker Agent 处理专业任务。

## 决策记录

| 决策 | 选择 | 理由 |
|------|------|------|
| 超级助手处理 | Ani 直接取代 | Supervisor = Ani，不需要单独的通用 Agent |
| 角色风格 | 专业助手（有定位，无情感） | 功能性定位，不强调人格 |
| Avatar 控制权 | Ani 自主控制 | Ani 拥有 avatar tools，自主决定调用时机 |
| Ani vs Worker | 可直答也可分发 | Ani 本身就是有能力回答的 Agent，简单问题无需分发 |
| Worker avatar tools | 仅 Ani 可用 | 统一表达控制入口，避免多个 Agent 同时控制 Avatar |
| 实现方案 | Supervisor 内置角色化 | 改动最小，语义清晰 |

## 数据模型

### Ani Agent 记录

```
id: ani
name: Ani
system_prompt: 见下方
traits: [专业助手特征]
tools: []  (空 — 运行时动态注入全部)
capabilities: 智能任务调度、通用对话、信息检索、Avatar 表达控制
enabled: true
is_builtin: true
is_system: true
standalone: false
avatar: [当前 Live2D 模型 URL]
max_turns: 5
handoff_targets: [所有非系统 Worker Agent 的 id]
rule_ids: []
```

### 迁移

- 删除 `builtin-general` 记录
- 新增 `ani` 记录
- 已有 session 的 `preferred_agent = 'builtin-general'` 迁移为 `ani`

### System Prompt

```
你是 Ani，[专业助手角色描述]。

## 工作方式
- 简单问题直接回答
- 需要专业处理的任务，转交给对应专家助手

## 表达能力
你可以随时调用以下工具控制你的 Avatar：
- express_emotion: 表达情绪（neutral/happy/sad/angry/surprised/sympathetic/thinking/excited）
- play_motion: 播放动作（Idle/Tap 组）

## 可调度的助手
{动态注入: 各 Worker Agent 的 name + capabilities}
```

不限制 avatar 工具调用频率，完全由 LLM 自行判断。

## 架构

### 图构建

**改造前**：
```
getGraph(preferredAgent)
  → standalone? → 单 Agent 图
  → 有 preferredAgent + 意图匹配? → Fast-path 直接路由
  → 否则 → buildSupervisorGraph() → 无角色 Supervisor + Workers
```

**改造后**：
```
getGraph(preferredAgent)
  → standalone agent? → 单 Agent 图（builtin-job-executor 等）
  → 否则 → buildAniSupervisorGraph() → Ani(Supervisor) + Workers
```

### Supervisor Builder 改造

`supervisor.builder.ts` 核心变化：

1. Ani 节点使用 Ani 的 system_prompt + 全部已注册 tools（包括 avatar）
2. Worker 节点获得各自配置的 tools，排除 avatar category
3. Supervisor prompt 中的路由指令融入 Ani 的 system_prompt
4. Ani 既是 Supervisor 也是可直答的 Agent

### Tool 分配策略

| 节点 | Tools |
|------|-------|
| Ani (Supervisor) | 全部已注册 tools（general + avatar + 所有 categories） |
| Worker Agent | 各自配置的 tools，排除 avatar category |

### Fast-path 简化

- 取消关键词意图匹配的 fast-path（Ani 自己判断是直答还是分发）
- 保留 `preferredAgent` 机制：用户选择了 Worker Agent 时，在 prompt 中注入偏好提示

## SSE 事件流

### Avatar 拦截

保持按 category 检查的方式：tool yield 属于 avatar category → 发送 avatar_action 事件。由于只有 Ani 拥有 avatar tools，效果等价于"只有 Ani 能触发 avatar 事件"。

### 示例：简单问题（Ani 直答）

```
→ text: "好的，我来帮你查一下"
→ avatar_action: { emotion: "thinking" }
→ text: "根据搜索结果..."
→ avatar_action: { emotion: "happy" }
→ done
```

### 示例：专业问题（分发 Worker）

```
→ avatar_action: { emotion: "thinking" }
→ agent_switch: "编程专家"
→ text: [Worker 编程回答]
→ agent_switch: "Ani"
→ text: "编程专家已经给了详细的解答..."
→ avatar_action: { emotion: "happy" }
→ done
```

## 前端变更

1. **Agent 配置页（系统 Agent tab）**：
   - `builtin-general`（超级助手）→ `ani`（Ani）
   - UI 逻辑不变（只读，不可编辑/删除）

2. **Session 列表**：
   - 已有 session 的 `preferred_agent = 'builtin-general'` 显示为「Ani」
   - 新建 session 默认 preferred_agent 为 `ani`

3. **ChatContainer / AgentIndicator**：
   - Agent 指示器显示 Ani 名称
   - 前端硬编码的 `builtin-general` 引用替换为 `ani`

4. **Avatar 组件**：
   - 无逻辑变更，avatar_action 事件来源对前端透明

## 改动文件清单

### 后端

| 文件 | 变更 |
|------|------|
| `backend/src/modules/langgraph/graph/supervisor.builder.ts` | Ani 节点 = Supervisor，使用 Ani prompt + 全部 tools；Worker 排除 avatar tools |
| `backend/src/modules/langgraph/langgraph.service.ts` | 删除 fast-path 意图匹配；`builtin-general` → `ani`；默认 preferred_agent 为 `ani` |
| `backend/src/modules/agent/agent.service.ts` | 种子数据：删除 `builtin-general`，新增 `ani` |
| `backend/src/modules/agent/agent.entity.ts` | 无变化（已有字段足够） |
| `backend/src/modules/langgraph/tools/avatar.tool.ts` | 无变化 |

### 前端

| 文件 | 变更 |
|------|------|
| `frontend/src/components/chat/AgentIndicator.vue` | `builtin-general` → `ani` |
| `frontend/src/components/chat/SessionList.vue` | 默认 preferred_agent → `ani`；显示名映射 |
| `frontend/src/components/chat/ChatContainer.vue` | `builtin-general` 引用 → `ani` |
| `frontend/src/views/AgentConfigView.vue` | 系统 Agent tab 显示 Ani（如果硬编码了 builtin-general 则替换） |
