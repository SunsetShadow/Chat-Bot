# 一文搞懂 Hermes：新顶流 Agent 如何从经验中自我进化

> 来源：腾讯云开发者（微信公众号） | 作者：李伟山 | 2026-04
> 原文：https://mp.weixin.qq.com/s/yHva-zLaRTxe8b4HSUr86Q

## 概述

Hermes Agent（Nous Research 开源，GitHub 71.8K Stars）的核心技术创新——**Skills 闭环系统**。实现了"经验提取 → 知识存储 → 智能检索 → 上下文注入 → 执行验证 → 自动改进"完整闭环。在所有开源 Agent 框架中，唯一内置闭环自学习机制。

## 一、七个阶段构成的闭环

Skills 系统让 AI Agent 像人类专家一样积累经验：把成功的做法写成 SOP，在使用中持续修订，可分享。

## 二、Skill 创建：从经验到知识的蒸馏

### 2.1 创建触发条件

Agent 自主决定（System Prompt 中编码），位于 `agent/prompt_builder.py`：

```python
SKILLS_GUIDANCE = (
    "After completing a complex task (5+ tool calls), fixing a tricky error, "
    "or discovering a non-trivial workflow, save the approach as a "
    "skill with skill_manage so you can reuse it next time.\n"
    "When using a skill and finding it outdated, incomplete, or wrong, "
    "patch it immediately with skill_manage(action='patch') — don't wait to be asked. "
    "Skills that aren't maintained become liabilities."
)
```

关键设计哲学：
- **5+ tool calls** — 简单任务不值得建 Skill
- **fixing a tricky error** — 踩过的坑是最有价值的知识
- **don't wait to be asked** — Agent 自主判断
- **Skills that aren't maintained become liabilities** — 过时的 Skill 比没有更危险

### 2.2 创建流程七道安全关卡

调用 `skill_manage(action="create")` 经过：

1. **名称验证** — 小写/数字/连字符，≤64字符，文件系统安全
2. **分类验证** — 单层目录名，无路径穿越
3. **Frontmatter 验证** — 必须有 YAML 头部含 name 和 description
4. **大小限制** — ≤100,000 字符（约 36K tokens）
5. **名称冲突检查** — 跨所有目录去重
6. **原子写入** — tempfile + os.replace() 防崩溃损坏
7. **安全扫描** — 90+ 威胁模式，失败则整个目录回滚删除

**原子写入**：先写临时文件，再 `os.replace()` 替换。进程崩溃不会产生损坏文件。

**写入后扫描**（非扫描后写入）：避免 TOCTOU 竞态条件。

### 2.3 Skill 文件格式

YAML Frontmatter + Markdown Body（agentskills.io 社区标准）：

```yaml
---
name: deploy-nextjs
description: Deploy Next.js apps to Vercel with environment configuration
version: 1.0.0
platforms: [macos, linux]
metadata:
  hermes:
    tags: [devops, nextjs, vercel]
    related_skills: [docker-deploy]
    fallback_for_toolsets: []
    requires_toolsets: [terminal]
    config:
      - key: vercel.team
        description: Vercel team slug
        default: ""
        prompt: Vercel team name
---
```

结构化元数据用于机器处理，自然语言正文用于 Agent 理解。

## 三、索引构建：两层缓存的极致优化

### 3.1 两层缓存

**Layer 1：进程内 LRU 缓存**
- 线程安全 OrderedDict，最多 8 条
- 缓存键：五元组（skills_dir, external_dirs, available_tools, available_toolsets, platform_hint）

**Layer 2：磁盘快照**
- 通过 mtime+size manifest 验证快照是否过期
- 任何文件变化 → manifest 不匹配 → 全量扫描

| 路径 | 耗时 | 场景 |
|------|------|------|
| Layer 1 命中 | ~0.001ms | 热路径 |
| Layer 2 命中 | ~1ms | 冷启动 |
| 全扫描 | 50-500ms | 文件变化后首次 |

### 3.2 生成的索引

注入 System Prompt，按分类组织，强制加载：

```
<available_skills>
  devops:
    - deploy-nextjs: Deploy Next.js apps to Vercel with environment config
  data-science:
    - pandas-eda: Exploratory data analysis workflow with pandas
</available_skills>
```

**"you MUST load it"** — 漏加载成本 >> 多加载成本。

## 四、条件激活：智能可见性控制

基于 frontmatter 元数据，控制哪些 Skill 在当前场景可见：

- **fallback_for_toolsets** — 主工具可用时隐藏 fallback skill
- **requires_toolsets** — 依赖工具不可用时隐藏
- **requires_tools** — 同理
- **platforms** — 操作系统级别过滤

解决**索引膨胀**问题。

## 五、渐进式加载（Progressive Disclosure）

受 Anthropic Claude Skills 启发：

1. System Prompt 只放索引（每个 Skill ~20 tokens）
2. Agent 判断需要时调用 `skill_view(name)` 加载完整内容
3. 有支撑文件时再按需加载

100 个 Skill → System Prompt 只增 ~2000 tokens（非 500K）。

### 加载过程安全检查

- **Prompt Injection 检测**：扫描 "ignore previous instructions" 等模式
- **路径穿越防护**：`../../.env` 等路径被拦截
- **环境变量依赖检查**：缺失时 CLI 模式交互提示，Gateway 模式引导设置

## 六、注入策略：User Message 而非 System Prompt

**最关键的架构决策**：Skill 内容作为 User Message 注入，不修改 System Prompt。

原因：**Prompt Cache**。System Prompt 变化会导致缓存失效，每轮重新处理。

代价：User Message 指令跟随权重低于 System Prompt。补偿：
- `[SYSTEM: ...]` 前缀标记模拟权威性
- System Prompt 中 "you MUST load it" 间接提升遵循概率

**成本-效果权衡**：牺牲一点可靠性，换取数十倍 API 成本节约。

## 七、自改进机制：闭环闭合点

### 7.1 触发方式

System Prompt + 工具 Schema 中强制要求：

- "patch it immediately"
- "before finishing"
- 使用中发现过时立即修正，不留到下次

### 7.2 Patch 实现

`_patch_skill()` 复用文件编辑工具的 Fuzzy Match 引擎：

- 空白规范化
- 缩进差异容忍
- 转义序列处理
- 块锚匹配

LLM 回忆内容常有微小格式差异，Fuzzy Match 减少失败率。

### 7.3 级联效应

Patch 成功 → 清除内存 LRU 缓存 + 磁盘快照（`clear_snapshot=True`）。

当前对话使用旧版 → 下个对话加载新版 → 最终一致性模型。

## 八、安全扫描：免疫系统

### 8.1 威胁模式库（90+ 种）

- 环境变量泄漏检测（curl 插入密钥变量）
- DAN 越狱攻击
- .env 文件直接访问
- 隐形 Unicode 字符（18 种）

### 8.2 信任分级策略

| 来源 | safe | caution | dangerous |
|------|------|---------|-----------|
| 内置 | allow | allow | allow |
| 受信任（OpenAI/Anthropic） | allow | allow | block |
| 社区 | allow | block | block |
| Agent 自创建 | allow | allow | ask |

### 8.3 结构性检查

- 文件数 ≤ 50
- 总大小 ≤ 1MB
- 单文件 ≤ 256KB
- 可疑二进制扩展名检测
- 符号链接逃逸检测

## 九、Skill 与 Memory 的分工

| 维度 | Memory | Skill |
|------|--------|-------|
| 回答什么 | "是什么" | "怎么做" |
| 内容 | 用户偏好、环境细节、工具特性 | 任务执行流程、陷阱、验证方法 |
| 生命周期 | 跨会话持久 | 跨会话持久 + 自我迭代 |

## 十、与学术前沿对照：Voyager → Hermes

Voyager（NVIDIA 2023）提出 Skill Library 概念（Minecraft 环境）。Hermes 做了完整工程化落地：并发安全、成本控制、恶意输入防护、跨平台兼容、缓存一致性、文件系统原子性。

## 十一、设计权衡与改进空间

### 优秀权衡

| 决策 | 收益 | 代价 |
|------|------|------|
| User Message 注入 | 保护 Prompt Cache，降 90%+ 成本 | 指令跟随权重略低 |
| 写入后扫描 | 避免 TOCTOU | 需回滚机制 |
| 两层缓存 | 平衡热路径和冷启动 | 缓存一致性复杂度 |
| Fuzzy Match | 提高 patch 成功率 | 可能匹配非预期位置 |
| 条件激活 | 控制索引膨胀 | frontmatter 复杂度 |

### 改进方向

1. **缺少版本控制** — patch 后旧版本丢失，无法回滚
2. **安全扫描仅依赖正则** — 可被编码技巧绕过，需语义审查
3. **索引匹配依赖 LLM 判断** — 名称/描述不精准时可能遗漏，可引入 embedding 预过滤
4. **单机存储** — 多设备无原生同步，Skills Hub 部分缓解

## 十二、总结

Skills 闭环系统 = 程序性记忆（Procedural Memory）的工程化模拟：

- **编码**：从成功执行中提取步骤和陷阱
- **存储**：YAML + Markdown 结构化格式
- **检索**：条件激活 + 渐进式披露，最小化 token 负担
- **巩固**：使用中自动 patch，越用越精准
- **迁移**：Skills Hub 社区分享，知识跨个体传播

核心问题：Agent 的知识，以什么形式存在、以什么方式演化？答案决定了下一代 Agent 是"聪明工具"还是"成长伙伴"。
