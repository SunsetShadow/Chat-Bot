# Harness Engineering 实践指南

> 基于 OpenAI Codex 团队、LangChain、Stripe 等团队的实战经验整理
> 更新日期：2026-03-30

---

## 目录

1. [什么是 Harness Engineering](#1-什么是-harness-engineering)
2. [核心原则：三大支柱](#2-核心原则三大支柱)
3. [成熟度模型：五级演进](#3-成熟度模型五级演进)
4. [可执行流程：从零到生产级](#4-可执行流程从零到生产级)
5. [行业案例](#5-行业案例)
6. [常见陷阱](#6-常见陷阱)
7. [关键概念对照表](#7-关键概念对照表)
8. [参考来源](#8-参考来源)

---

## 1. 什么是 Harness Engineering

### 定义

**Harness Engineering（驾驭工程）** 是一门设计环境、约束和反馈循环的系统工程学科，使 AI 编码 Agent 能够可靠地自主完成软件工作。

核心公式：

```
Harness = 约束（Constrain） + 信息（Inform） + 验证（Verify） + 纠偏（Correct）
```

### 马的隐喻

| 角色 | 含义 |
|------|------|
| **马** | AI 模型 — 强大、快速，但不知道往哪跑 |
| **驾驭具** | 基础设施 — 约束、护栏、反馈循环，将模型的力量导向正确方向 |
| **骑手** | 人类工程师 — 提供方向，不亲自跑 |

### 为什么现在重要

- **模型是商品，Harness 是护城河**。LangChain 仅通过改进 Harness（不改模型），在 Terminal Bench 2.0 上从 Top 30 跳到 Top 5（52.8% → 66.5%）
- **OpenAI 的实证**：5 个月、100 万+行代码、零手写代码，产品已有日活用户

---

## 2. 核心原则：三大支柱

### 支柱一：上下文工程（Context Engineering）

> 从 Agent 的视角，任何它无法在运行时访问的东西 = 不存在。

**静态上下文：**

- `AGENTS.md` / `CLAUDE.md` — 项目级规则，作为**目录**而非百科全书（~100 行）
- `docs/` 目录 — 架构规范、API 契约、设计文档、质量评分
- 代码内联文档 — 可被 Agent 直接读取的注释和类型定义

**动态上下文：**

- 日志（LogQL）、指标（PromQL）、链路追踪 — Agent 可查询
- 目录结构映射 — Agent 启动时自动感知代码库
- CI/CD 状态和测试结果 — Agent 可获取反馈

**关键规则：**

| 不要 | 要 |
|------|-----|
| 把所有规则塞进一个巨大文件 | 用 ~100 行的 AGENTS.md 作为目录，指向深层文档 |
| 知识存在 Slack/Google Docs/人脑中 | 一切知识都在仓库中，版本化、可发现 |
| 一次性给 Agent 所有信息 | 渐进式披露（Progressive Disclosure）— 入口小，按需深入 |

**可执行动作：**

```bash
# 1. 创建 AGENTS.md 作为目录文件（而非百科）
# 示例结构：
# - 项目概述（5 行）
# - 架构分层规则（10 行）
# - 指向 docs/ 的链接（20 行）
# - 编码约定摘要（15 行）
# - 测试策略链接（10 行）
# 总计 < 100 行

# 2. 创建结构化文档目录
mkdir -p docs/{architecture,design-decisions,quality,execution-plans}

# 3. 用 linter 验证文档的时效性和交叉引用
# 示例：自定义 CI job 检查文档与代码的一致性
```

### 支柱二：架构约束（Architectural Constraints）

> 不靠代码审查保持一致性，靠机械化执行。

**依赖分层：**

```
Types → Config → Repo → Service → Runtime → UI
```

每一层只能依赖其左侧的层。这不是建议 — 由结构化测试和 CI 强制执行。

**约束工具链：**

| 工具 | 作用 |
|------|------|
| 自定义 Linter | 命名规范、文件大小限制、结构化日志、架构边界 |
| 结构化测试 | 类似 ArchUnit，验证依赖方向 |
| Pre-commit Hooks | 提交前自动检查 |
| LLM 审计器 | Agent 审查其他 Agent 的代码合规性 |

**关键原则：约束使 Agent 更高效而非受限。** 明确的边界让 Agent 更快收敛到正确解，而非在无限空间中浪费 token。

**可执行动作：**

```bash
# 1. 定义分层架构规则（写入 AGENTS.md）
# 2. 编写自定义 linter 检查：
#    - 文件大小限制（如单文件不超过 300 行）
#    - 命名约定（如 schema 用 camelCase，表名用 snake_case）
#    - 依赖方向（如 UI 层不能直接导入 Repo 层）
#    - 结构化日志（禁止 console.log，必须用结构化 logger）
# 3. 将 linter 集成到 CI pipeline
# 4. Linter 报错信息包含修复指南（Agent 可直接执行）
```

### 支柱三：熵管理（Entropy Management）

> 技术债是高息贷款，持续小额偿还远优于集中痛苦清偿。

**问题：** Agent 会复制仓库中已有的模式，包括不优化的。随时间推移，代码库会漂移。

**解决方案：周期性清理 Agent**

| 清理类型 | 频率 | 内容 |
|----------|------|------|
| 文档一致性 | 每日 | 验证文档与当前代码是否匹配 |
| 模式偏差扫描 | 每周 | 检测偏离已建立模式的代码 |
| 死代码清理 | 每周 | 移除未使用的导入、函数、文件 |
| 依赖审计 | 每周 | 发现循环依赖、多余依赖 |
| 质量评分更新 | 每周 | 更新各领域的质量评分 |

**可执行动作：**

```bash
# 1. 制定「黄金原则」并写入仓库
#    示例：
#    - 优先使用共享工具包而非手写 helper
#    - 不猜测数据结构，必须在边界处验证
#    - 结构化日志，不用 console.log

# 2. 配置定期清理任务（cron / CI scheduled job）
# 3. 清理 Agent 的 PR 应可在 1 分钟内审核完
# 4. 跟踪质量信号：flake rate、覆盖率趋势、回归频率
```

---

## 3. 成熟度模型：五级演进

> 每一级解锁下一级，不可跳级。没有护栏的 Agent = 混乱。

### Level 1：文档化（Foundation）

**适合：** 小团队，刚起步

**目标：** 所有质量规则已写下来、版本化、全员可访问

**检查清单：**
- [ ] 审计隐性知识：Slack 线程、Wiki 页面、老员工脑中的经验
- [ ] 质量标准写入仓库，作为版本化文档
- [ ] 测试用例移入共享管理平台，全员可见
- [ ] 基础 CI 配置好，每次 push 自动运行测试

**关键里程碑：** 新成员（或 Agent）可以从仓库发现所有质量规则

### Level 2：门控化（Automated）

**适合：** 已有 CI/CD 的团队

**目标：** 顶部质量规则编码为 linter/CI 门控，不仅是文档而是强制执行

**检查清单：**
- [ ] 识别 reviewer 最常重复的 Top 5 质量规则，编码为自动检查
- [ ] 测试环境可一键启动、一键销毁，按分支隔离
- [ ] 集成 AI 测试工具到 CI，获得智能分析而非仅 pass/fail
- [ ] 一个命令可运行全量测试

**关键里程碑：** 新贡献者（人或 Agent）可一条命令跑完所有测试

### Level 3：可观测（Agent-Legible）

**适合：** 探索 AI 辅助开发的团队

**目标：** 测试环境可自我描述，Agent 能自主操作

**检查清单：**
- [ ] 测试文档采用渐进式披露结构（索引 → 深层文档）
- [ ] 日志、指标、应用状态对 Agent 工具可见
- [ ] Agent 可启动应用、导航页面、验证行为
- [ ] 开始用 AI Agent 生成测试初稿，人工审核覆盖缺口

**关键里程碑：** Agent 能从 bug 描述复现问题

### Level 4：自治（Agent-Driven）

**适合：** Agent 工具成熟的团队

**目标：** Agent 端到端处理 bug 复现→修复→验证循环

**检查清单：**
- [ ] 建立反馈循环：flake rate、覆盖率漂移、回归模式自动告警
- [ ] 定期自动清理：每周扫描过期测试、死代码、过时文档
- [ ] 定义明确的升级标准，Agent 知道何时请求人类判断
- [ ] Agent 可自行打开和合并修复 PR

**关键里程碑：** Agent 在 QA 定义的护栏内自主合并修复 PR，人类按异常审核

### Level 5：复合增长（Self-Healing）

**适合：** 北极星目标

**目标：** 全反馈循环，质量随时间自主提升

**检查清单：**
- [ ] Agent 从可观测信号检测回归、编写修复、验证并部署
- [ ] QA 设计系统，极少触碰单个测试
- [ ] 回归平均修复时间以分钟计，而非天

**关键里程碑：** MTTR（平均修复时间）以分钟衡量

---

## 4. 可执行流程：从零到生产级

### Phase 1：建立基础（第 1-2 天）

```
Step 1.1  审计现有知识
├── 盘点所有质量规则（Slack、Wiki、口头约定）
├── 识别隐性 tribal knowledge
└── 输出：知识审计报告

Step 1.2  仓库文档化
├── 创建 AGENTS.md（< 100 行目录式）
├── 创建 docs/ 结构化目录
│   ├── architecture/       # 架构规范
│   ├── design-decisions/   # 设计决策记录
│   ├── quality/            # 质量评分和标准
│   └── execution-plans/    # 执行计划
├── 将所有质量规则迁入仓库
└── 输出：Agent 可发现的文档体系

Step 1.3  基础 CI 配置
├── 每次 push 自动运行测试
├── 代码格式化检查（prettier / black / gofmt）
└── 输出：自动化质量底线
```

### Phase 2：编码约束（第 3-7 天）

```
Step 2.1  识别 Top 5 规则
├── 收集 reviewer 最常重复的反馈
├── 提炼为可机械化检查的规则
└── 示例：
    1. "API 入口必须验证输入"
    2. "禁止提交密钥"
    3. "每个端点需要集成测试"
    4. "依赖方向必须符合分层"
    5. "日志必须结构化"

Step 2.2  实现自定义 Linter
├── 每条规则实现为独立的 lint 检查
├── 错误信息包含修复指南（Agent 可操作）
├── 集成到 pre-commit hook 和 CI
└── 输出：机械化执行的质量门控

Step 2.3  可复现测试环境
├── 一键启动完整测试环境
├── 一键销毁，不留残留
├── 按分支隔离（避免并行干扰）
└── 输出：Agent 可独立操作的测试环境
```

### Phase 3：Agent 可观测性（第 2-4 周）

```
Step 3.1  渐进式文档结构
├── AGENTS.md 作为入口（100 行）
├── 按领域拆分为子文档
├── 每个子文档引用具体测试套件和验收标准
└── 输出：Agent 可按需深入的文档体系

Step 3.2  可观测性集成
├── 日志暴露给 Agent 工具（LogQL）
├── 指标暴露给 Agent 工具（PromQL）
├── DOM/UI 状态通过 CDP 协议可访问
├── 按 worktree 隔离的可观测栈
└── 输出：Agent 可自主诊断问题

Step 3.3  Agent 测试生成
├── Agent 生成单元测试初稿
├── 人工审核覆盖缺口和边界情况
├── 逐步扩展到集成测试
└── 输出：人机协作的测试生成流水线
```

### Phase 4：自治循环（第 1-2 月）

```
Step 4.1  质量评分系统
├── 按产品领域和架构层评分
├── 自动追踪：flake rate、覆盖率趋势、回归频率
├── 质量下降时自动告警
└── 输出：可量化的质量仪表盘

Step 4.2  周期性清理 Agent
├── 每周扫描过期测试、死代码、过时文档
├── 自动打开清理 PR（< 1 分钟可审核）
├── 自动合并通过检查的清理 PR
└── 输出：持续熵减的代码库

Step 4.3  扩展 Agent 自治范围
├── 单元测试 → 集成测试 → E2E 测试
├── bug 复现 → 修复 → 验证 循环
├── 定义明确的人类升级标准
└── 输出：逐步扩大的 Agent 自治边界
```

### Phase 5：复合增长（持续优化）

```
Step 5.1  全链路自动化
├── Agent 从可观测信号检测回归
├── 自动编写修复、验证、部署
├── 人类仅在需要判断时介入
└── 输出：自修复系统

Step 5.2  持续改进 Harness
├── 每次模型升级后审查 Harness 有效性
├── 移除已被模型能力覆盖的「智能」逻辑
├── 保持 Harness 可拆（rippable）
└── 输出：随模型进化的驾驭系统
```

---

## 5. 行业案例

### OpenAI Codex 团队

- **规模：** 3→7 工程师，5 个月，100 万+行代码
- **吞吐：** 3.5 PR/工程师/天（随团队增长而增加）
- **关键做法：**
  - 仓库作为唯一知识源，一切版本化
  - 自定义 linter 强制执行架构约束
  - 按工作区隔离的临时可观测栈
  - 周期性清理 Agent 对抗熵增
  - Agent 处理完整 bug 生命周期（复现→录制→修复→验证→PR→合并）

### Stripe Minions

- **规模：** 每周 1000+ 合并的 PR
- **流程：** 开发者在 Slack 发布任务 → Minion 写代码 → Minion 过 CI → Minion 开 PR → 人类审核合并
- **关键做法：** 开发者从第 1 步到第 5 步零介入，Harness 处理一切

### LangChain

- **改进：** 仅改 Harness，Terminal Bench 2.0 从 52.8% → 66.5%（Top 30 → Top 5）
- **中间件栈：**
  ```
  Agent Request
    → LocalContextMiddleware   # 映射代码库结构
    → LoopDetectionMiddleware  # 防止重复循环
    → ReasoningSandwichMiddleware  # 优化推理资源
    → PreCompletionChecklistMiddleware  # 提交前自检
    → Agent Response
  ```

---

## 6. 常见陷阱

### 陷阱 1：过度工程化控制流

> "如果你过度工程化控制流，下一次模型更新会打破你的系统。" — OpenAI

模型能力快速增长。2024 年需要复杂 pipeline 的能力，现在一个上下文窗口提示就搞定了。构建可拆的（rippable）Harness — 当模型够强时可以移除「聪明」逻辑。

### 陷阱 2：把 Harness 当静态系统

Harness 必须随模型进化。新模型发布改进了推理能力时，你的推理优化中间件可能反而有害。每次重大模型更新后审查 Harness。

### 陷阱 3：忽视文档层

**最高杠杆的 Harness 改进往往最简单：更好的文档。** AGENTS.md 含糊，Agent 输出就含糊。投资精确的、机器可读的文档。

### 陷阱 4：没有反馈循环

没有反馈的 Harness 是笼子，不是向导。Agent 需要知道何时成功、何时失败：

- 任务完成前的自检步骤
- 测试执行作为 Agent 工作流的一部分
- 按任务类型追踪 Agent 成功率

### 陷阱 5：仅人类可读的文档

架构决策存在 Confluence 或人脑中 = Harness 有缺口。**Agent 需要的一切必须在仓库中。**

### 陷阱 6：巨型 AGENTS.md

- 上下文是稀缺资源 — 巨型指令文件会挤掉任务、代码和相关文档
- 一切都标记为「重要」= 没有什么是重要的
- 文档立即腐烂 — 无法机械化验证一致性

---

## 7. 关键概念对照表

| 概念 | 范围 | 焦点 |
|------|------|------|
| **Prompt Engineering** | 单次交互 | 优化提示词 |
| **Context Engineering** | 模型上下文窗口 | Agent 看到什么信息 |
| **Harness Engineering** | 整个 Agent 系统 | 环境、约束、反馈、生命周期 |
| **Agent Engineering** | Agent 架构 | Agent 内部设计和路由 |
| **Platform Engineering** | 基础设施 | 部署、扩缩容、运维 |

**层级关系：** Harness Engineering 包含 Context Engineering，借鉴 Prompt Engineering，但在更高层次运作。

---

## 8. 参考来源

- [OpenAI - Harness Engineering: Leveraging Codex in an Agent-First World](https://openai.com/index/harness-engineering/) — OpenAI 官方博客，零手写代码实验的一手记录
- [NXCode - Harness Engineering: The Complete Guide (2026)](https://www.nxcode.io/resources/news/harness-engineering-complete-guide-ai-agent-codex-2026) — 综合指南，含 LangChain/Stripe 案例
- [TestCollab - Harness Engineering: What It Means for QA](https://testcollab.com/blog/harness-engineering) — QA 视角的成熟度模型和分步框架
