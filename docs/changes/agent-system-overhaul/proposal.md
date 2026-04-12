# Agent 系统全面重构

## 变更 ID
`agent-system-overhaul`

## 动机

当前 Agent 配置页面存在功能性 bug（新增/编辑 Agent 时 Modal 弹窗无法打开），同时系统缺乏 Agent 间协作、工具权限控制、Human-in-the-Loop 等现代 Multi-Agent 系统应有的能力。

## 目标

1. 修复 Agent 配置页面 bug，确保 CRUD 全链路可用
2. 完善配置页面 UI（表单校验、模板预设、复制 Agent）
3. 增强 Agent 协作机制（Agent 间委托、Supervisor 路由优化）
4. 增强工具系统（权限分级、web_search 实现确认、超时重试）
5. 提升聊天体验（Agent 实时指示、协作可视化、HITL）

## 分阶段实施

### 阶段 1：Bug 修复 + 配置页面完善

**1.1 修复 Modal 弹窗**
- `AgentConfigView.vue` 的 `onMounted` 添加 try-catch
- 确认后端端口配置
- 验证 NModal 在 API 失败场景下仍能正常弹出

**1.2 配置页面 UI 改进**
- 表单校验反馈（名称必填、系统提示词必填）
- 操作成功/失败的 Toast 提示（Naive UI `useMessage`）
- 「复制 Agent」功能
- Agent 模板预设
- 删除确认弹窗

**1.3 代码清理**
- 移除 `AgentEditor.vue`
- 移除 `llm/` 模块死代码

### 阶段 2：Agent 协作机制 + 工具系统

**2.1 Supervisor 路由优化**
- 改进路由 prompt，增加 few-shot 示例
- 基于 capabilities 做更精确的语义匹配
- 多轮对话中的 Agent 上下文保持

**2.2 Agent 间通信协议**
- 添加 `delegate_to_agent` 工具
- StreamEvent 中添加 delegation 事件类型
- 前端展示协作链路

**2.3 工具系统增强**
- 确认 web-search 实现
- 工具权限分级（read/write/confirm）
- ToolInfo 扩展（permission_level, category）
- 工具执行超时和重试

**2.4 Human-in-the-Loop**
- 关键工具执行前暂停等待用户确认
- 前端确认对话框组件
- LangGraphService 支持 interrupt/resume

### 阶段 3：聊天体验增强

**3.1 Agent 实时切换指示**
- 完善 AgentIndicator
- Agent 切换过渡动画
- 用户手动指定 Agent

**3.2 多 Agent 协作可视化**
- 协作关系展示
- 工具调用卡片化
- Agent 决策推理展示

**3.3 Agent 上下文管理**
- 每个 Agent 独立上下文
- 切换时保留/恢复上下文
- 跨 Agent 共享记忆

## 技术决策

| 决策点 | 选择 | 理由 |
|--------|------|------|
| 多 Agent 架构 | Supervisor + Agent 间委托 | 已有 Supervisor 基础，加委托工具改动更小 |
| HITL 实现 | LangGraph interrupt + 前端确认弹窗 | 原生支持 |
| Agent 间通信 | `delegate_to_agent` 工具 | 保持图结构不变 |
| 工具权限 | 扩展 ToolInfo 类型 | 最小侵入 |

## 数据模型变更

### Agent 实体新增字段
- `avatar: string?` — Agent 头像
- `category: string?` — Agent 分类
- `max_turns: number?` — 单次对话最大轮次
- `handoff_targets: string[]?` — 允许委托的目标 Agent ID 列表

### ToolInfo 扩展
- `permission_level: 'read' | 'write' | 'confirm'` — 权限级别
- `category: string` — 工具分类

### 新增事件类型
- `DelegationEvent` — Agent 间委托事件

## 文件变更预估

| 阶段 | 新增 | 修改 | 删除 |
|------|------|------|------|
| 阶段 1 | 2 | 5 | 5 |
| 阶段 2 | 4 | 8 | 0 |
| 阶段 3 | 3 | 6 | 0 |

## 风险

| 风险 | 缓解 |
|------|------|
| 后端端口配置阻塞开发 | 阶段 1 第一步确认 |
| Agent 间委托循环调用 | 白名单 + 最大深度限制 |
| HITL 增加延迟 | 仅 confirm 级别触发 |

## 参考资料

- [LangGraph Multi-Agent Supervisor](https://www.npmjs.com/package/@langchain/langgraph-supervisor)
- [LangGraph Swarm vs Supervisor](https://medium.com/@sameernasirshaikh/langgraph-swarm-vs-langgraph-supervisor-ce8194837d0a)
- [Benchmarking Multi-Agent Architectures](https://blog.langchain.com/benchmarking-multi-agent-architectures/)
- [The Multi-Agent Trap](https://towardsdatascience.com/the-multi-agent-trap/)
