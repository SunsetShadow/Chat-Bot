# Agent Skills 系统设计与实现参考

> 基于 OpenClaw 项目源码分析，提炼出一套可复用的 Agent Skills 系统架构。
> 适用于任何需要为 AI Agent 提供「可插拔能力指令」的项目。

---

## 1. 核心概念

### 1.1 什么是 Skill

Skill 是一段 Markdown 格式的指令文本（`SKILL.md`），注入到 Agent 的 system prompt 中，教会 Agent **何时以及如何使用某个工具或执行某类任务**。

关键设计决策：**Skill 不是代码，而是指令**。Agent 通过读取 Skill 文件获取上下文知识，然后利用已有的工具（exec、browser、web_search 等）完成任务。

### 1.2 设计哲学

| 原则 | 说明 |
|------|------|
| 声明式 | Skill 用 YAML frontmatter + Markdown 声明元数据和指令 |
| 可插拔 | 支持多来源、多层级加载，按名称去重，高优先级覆盖低优先级 |
| 安全校验 | 第三方 Skill 需经安全扫描，环境变量注入有白名单/黑名单控制 |
| Token 经济 | Skill 列表按预算裁剪，路径压缩（`~` 替代 home 目录），支持 compact 模式 |
| 热更新 | 文件监视器检测 SKILL.md 变更，触发 session 级快照刷新 |

---

## 2. Skill 文件格式

每个 Skill 是一个目录，包含 `SKILL.md` 文件：

```
skills/
├── github/
│   └── SKILL.md        # 必需
├── slack/
│   └── SKILL.md
└── weather/
    ├── SKILL.md
    └── templates/      # 可选：附带的模板/数据文件
        └── report.md
```

### 2.1 SKILL.md 结构

```markdown
---
name: github
description: "Use gh for GitHub issues, PR status, CI/logs, comments, reviews."
metadata:
  openclaw:
    emoji: "🐙"
    requires:
      bins: ["gh"]
      env: ["GITHUB_TOKEN"]
    primaryEnv: GITHUB_TOKEN
    os: ["darwin", "linux"]
    install:
      - id: brew
        kind: brew
        formula: gh
        bins: ["gh"]
        label: Install GitHub CLI (brew)
user-invocable: true
disable-model-invocation: false
---

# GitHub CLI Skill

Use `gh` for all GitHub operations...

## Issues
- List issues: `gh issue list`
...
```

### 2.2 Frontmatter 字段规范

**必需字段：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `name` | string | 唯一标识符（snake_case） |
| `description` | string | 一行描述，Agent 据此判断是否匹配任务 |

**可选元数据（metadata.openclaw）：**

| 字段 | 类型 | 说明 |
|------|------|------|
| `emoji` | string | UI 展示用 |
| `homepage` | string | 项目主页 URL |
| `os` | string[] | 平台过滤：`darwin`、`linux`、`win32` |
| `requires.bins` | string[] | 必须存在于 PATH 的二进制（全部满足） |
| `requires.anyBins` | string[] | 至少一个存在于 PATH |
| `requires.env` | string[] | 必须存在的环境变量 |
| `requires.config` | string[] | 必须为 truthy 的配置路径 |
| `primaryEnv` | string | 关联的环境变量名（用于 API key 注入） |
| `always` | boolean | 跳过其他门控，始终包含 |
| `install` | InstallSpec[] | 安装规格列表 |
| `skillKey` | string | 自定义配置键名（默认等于 name） |

**调用策略：**

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `user-invocable` | true | 是否作为 slash command 暴露给用户 |
| `disable-model-invocation` | false | 从 model prompt 中排除（仅用户手动触发） |

### 2.3 安装规格（InstallSpec）

| kind | 必需字段 | 说明 |
|------|---------|------|
| `brew` | `formula`, `bins` | Homebrew 安装 |
| `node` | `package`, `bins` | npm/pnpm/yarn/bun 包安装 |
| `go` | `module`, `bins` | Go module 安装 |
| `uv` | `package`, `bins` | Python/uv 包安装 |
| `download` | `url` | 直接下载 |

每个安装规格共享字段：`id`, `label`, `bins`, `os`

---

## 3. 类型系统

### 3.1 核心 TypeScript 类型

```typescript
// Skill 基础类型（扩展自 pi-coding-agent 规范）
type Skill = {
  name: string;
  description: string;
  filePath: string;       // SKILL.md 的绝对路径
  baseDir: string;        // Skill 目录的绝对路径
  source: string;         // 来源标识（如 "openclaw-bundled"）
  sourceInfo: SourceInfo;  // 来源元信息
  disableModelInvocation?: boolean;
};

// OpenClaw 特有元数据
type OpenClawSkillMetadata = {
  always?: boolean;
  skillKey?: string;
  primaryEnv?: string;
  emoji?: string;
  homepage?: string;
  os?: string[];
  requires?: {
    bins?: string[];
    anyBins?: string[];
    env?: string[];
    config?: string[];
  };
  install?: SkillInstallSpec[];
};

// 完整的 Skill 条目（加载后）
type SkillEntry = {
  skill: Skill;
  frontmatter: ParsedSkillFrontmatter;
  metadata?: OpenClawSkillMetadata;
  invocation?: SkillInvocationPolicy;
  exposure?: SkillExposure;
};

// 会话级快照（缓存）
type SkillSnapshot = {
  prompt: string;           // 预构建的 prompt 文本
  skills: Array<{
    name: string;
    primaryEnv?: string;
    requiredEnv?: string[];
  }>;
  skillFilter?: string[];
  resolvedSkills?: Skill[];
  version?: number;         // 版本号，用于热更新检测
};
```

### 3.2 配置类型

```typescript
type SkillsConfig = {
  allowBundled?: string[];         // 内置 Skill 白名单
  load?: {
    extraDirs?: string[];           // 额外 Skill 目录
    watch?: boolean;                // 文件监视（默认 true）
    watchDebounceMs?: number;       // 防抖（默认 250ms）
  };
  install?: {
    preferBrew?: boolean;
    nodeManager?: "npm" | "pnpm" | "yarn" | "bun";
  };
  limits?: {
    maxCandidatesPerRoot?: number;  // 每个根目录最大候选数（默认 300）
    maxSkillsLoadedPerSource?: number;  // 每来源最大加载数（默认 200）
    maxSkillsInPrompt?: number;     // prompt 中最大 Skill 数（默认 150）
    maxSkillsPromptChars?: number;  // prompt 最大字符数（默认 18000）
    maxSkillFileBytes?: number;     // 单文件最大字节数（默认 256KB）
  };
  entries?: Record<string, {
    enabled?: boolean;
    apiKey?: SecretInput;
    env?: Record<string, string>;
    config?: Record<string, unknown>;
  }>;
};
```

---

## 4. 加载管线（Loading Pipeline）

### 4.1 多来源优先级

从低到高，高优先级覆盖同名 Skill：

```
1. extraDirs       → skills.load.extraDirs 配置的额外目录
2. bundled         → 随应用分发的内置 Skill
3. managed         → ~/.openclaw/skills（用户管理的本地 Skill）
4. agents-personal → ~/.agents/skills（个人级 Agent Skill）
5. agents-project  → <workspace>/.agents/skills（项目级 Agent Skill）
6. workspace       → <workspace>/skills（工作区级，最高优先级）
7. plugin          → 插件内 skills/ 目录（合入 extraDirs 层）
```

### 4.2 加载流程

```
┌─────────────┐
│  1. Discover │  扫描各来源目录，列出候选 Skill 目录
└──────┬──────┘
       │
┌──────▼──────┐
│  2. Parse    │  读取 SKILL.md，解析 YAML frontmatter
└──────┬──────┘
       │
┌──────▼──────┐
│  3. Validate │  校验 name、description 非空；校验文件大小
└──────┬──────┘
       │
┌──────▼──────┐
│  4. Merge    │  按优先级合并，Map<name, entry> 去重
└──────┬──────┘
       │
┌──────▼──────┐
│  5. Gate     │  OS/二进制/环境变量/配置/白名单过滤
└──────┬──────┘
       │
┌──────▼──────┐
│  6. Filter   │  Agent 级 allowlist 过滤
└──────┬──────┘
       │
┌──────▼──────┐
│  7. Compact  │  路径压缩（~ 替代 home 目录）
└──────┬──────┘
       │
┌──────▼──────┐
│  8. Budget   │  按 Token/字符预算裁剪，必要时降级 compact 模式
└──────┬──────┘
       │
┌──────▼──────┐
│  9. Render   │  生成 XML 格式的 prompt 文本
└──────┬──────┘
       │
┌──────▼──────┐
│ 10. Snapshot │  缓存到 session 级快照
└─────────────┘
```

### 4.3 关键实现细节

**目录扫描安全性：**
```typescript
// local-loader.ts 核心逻辑
function loadSkillsFromDirSafe(params) {
  // 1. realpath 解析根目录（防止符号链接逃逸）
  const rootRealPath = fs.realpathSync(rootDir);

  // 2. 读取 SKILL.md 时验证路径在根目录内
  if (!isPathWithinRoot(rootRealPath, candidatePath)) {
    return null;
  }

  // 3. 排序保证确定性（对 prompt 缓存友好）
  return dirs.sort((a, b) => a.localeCompare(b));
}
```

**合并去重：**
```typescript
// workspace.ts - 按 source 优先级逐步写入 Map
const merged = new Map<string, LoadedSkillRecord>();
for (const record of extraSkills)          merged.set(record.skill.name, record);
for (const record of bundledSkills)        merged.set(record.skill.name, record);  // 覆盖
for (const record of managedSkills)        merged.set(record.skill.name, record);  // 覆盖
for (const record of personalAgentsSkills) merged.set(record.skill.name, record);  // 覆盖
for (const record of projectAgentsSkills)  merged.set(record.skill.name, record);  // 覆盖
for (const record of workspaceSkills)      merged.set(record.skill.name, record);  // 覆盖
```

**Token 预算管理：**
```typescript
// 三级降级策略
function applySkillsPromptLimits(skills, config) {
  // Level 1: 完整格式（name + description + location）
  if (fitsFull(skills)) return { compact: false, truncated: false };

  // Level 2: compact 格式（name + location，省略 description）
  if (fitsCompact(skills)) return { compact: true, truncated: false };

  // Level 3: 二分查找最大可容纳数量，截断
  const maxFit = binarySearchMaxFit(skills, compactBudget);
  return { compact: true, truncated: true, skillsForPrompt: skills.slice(0, maxFit) };
}
```

---

## 5. Prompt 集成

### 5.1 XML 格式输出

```xml
The following skills provide specialized instructions for specific tasks.
Use the read tool to load a skill's file when the task matches its description.
When a skill file references a relative path, resolve it against the skill directory.

<available_skills>
  <skill>
    <name>github</name>
    <description>Use gh for GitHub issues, PR status, CI/logs...</description>
    <location>~/.bun/.../skills/github/SKILL.md</location>
  </skill>
  <skill>
    <name>slack</name>
    <description>Slack tool for reactions, messages, pins...</description>
    <location>~/.bun/.../skills/slack/SKILL.md</location>
  </skill>
</available_skills>
```

**Token 开销估算：**
- 基础开销：~195 字符（~49 tokens）
- 每个 Skill：~97 字符 + len(name) + len(description) + len(location)
- Compact 模式省略 description，约减少 40-60%

### 5.2 路径压缩

```typescript
// 将 /Users/alice/.bun/.../skills/github/SKILL.md
// 压缩为 ~/.bun/.../skills/github/SKILL.md
// 每个 Skill 节省约 5-6 tokens
function compactHomePath(filePath, homes) {
  for (const home of homes) {
    if (filePath.startsWith(home + path.sep)) {
      return "~/" + filePath.slice(home.length + 1);
    }
  }
  return filePath;
}
```

---

## 6. 门控系统（Gating）

### 6.1 多层过滤

```typescript
function shouldIncludeSkill({ entry, config, eligibility }) {
  // 1. 配置级开关：skills.entries.<key>.enabled === false → 排除
  if (skillConfig?.enabled === false) return false;

  // 2. 内置白名单：skills.allowBundled 非空时，仅包含白名单中的内置 Skill
  if (!isBundledSkillAllowed(entry, allowBundled)) return false;

  // 3. 运行时资格检查
  return evaluateRuntimeEligibility({
    os: entry.metadata?.os,                    // OS 过滤
    requires: entry.metadata?.requires,         // 二进制/环境变量/配置需求
    hasBin,                                     // 检查二进制是否在 PATH
    hasEnv: (name) => process.env[name] || skillConfig?.env?.[name],
    isConfigPathTruthy: (path) => isConfigPathTruthy(config, path),
  });
}
```

### 6.2 Agent 级 Allowlist

```json5
{
  agents: {
    defaults: {
      skills: ["github", "weather"],  // 所有 Agent 默认可用
    },
    list: [
      { id: "writer", skills: [] },             // 覆盖：无 Skill
      { id: "coder", skills: ["github"] },      // 覆盖：仅 github
      { id: "full", /* 不指定 */ },              // 继承 defaults
    ],
  },
}
```

---

## 7. 环境变量注入

### 7.1 作用域

环境变量注入仅在 Agent 运行期间生效，运行结束后恢复原始值。

```typescript
function applySkillEnvOverrides({ skills, config }) {
  const updates = [];

  for (const entry of skills) {
    const skillConfig = resolveSkillConfig(config, skillKey);
    if (!skillConfig) continue;

    // 注入 skills.entries.<key>.env
    // 注入 skills.entries.<key>.apiKey → 映射到 primaryEnv
    applySkillConfigEnvOverrides({ updates, skillConfig, ... });
  }

  // 返回恢复函数
  return () => {
    for (const update of updates) {
      releaseActiveSkillEnvKey(update.key);  // 恢复 baseline
    }
  };
}
```

### 7.2 安全限制

```typescript
// 永远阻止的环境变量模式
const SKILL_ALWAYS_BLOCKED_ENV_PATTERNS = [/^OPENSSL_CONF$/i];

// 检查函数
function isAlwaysBlockedSkillEnvKey(key) {
  return (
    isDangerousHostEnvVarName(key) ||           // PATH, HOME 等
    isDangerousHostEnvOverrideVarName(key) ||   // 运行时加载类变量
    matchesAnyPattern(key, BLOCKED_PATTERNS)
  );
}
```

---

## 8. 安全扫描器

### 8.1 扫描规则

第三方 Skill 在安装前需经安全扫描，检测可执行代码中的危险模式：

**Critical 级别（阻止安装）：**

| 规则 ID | 检测内容 |
|---------|---------|
| `dangerous-exec` | child_process 调用（exec、spawn 等） |
| `dynamic-code-execution` | eval()、new Function() |
| `crypto-mining` | 加密挖矿关键词 |
| `env-harvesting` | process.env + 网络发送（凭证窃取） |

**Warn 级别（警告但不阻止）：**

| 规则 ID | 检测内容 |
|---------|---------|
| `suspicious-network` | 非标准端口的 WebSocket 连接 |
| `potential-exfiltration` | 文件读取 + 网络发送 |
| `obfuscated-code` | 十六进制编码序列 / 大 Base64 载荷 |

### 8.2 扫描架构

```
scanDirectory()
  ├── walkDirWithLimit()          // 遍历目录，限制文件数
  ├── collectScannableFiles()     // 收集 .js/.ts/.mjs 等可扫描文件
  └── scanFileWithCache()         // 带缓存的文件扫描
        ├── 文件大小检查（默认 1MB 上限）
        ├── mtime 缓存命中判断
        └── scanSource()          // 正则规则匹配
              ├── LINE_RULES      // 逐行匹配
              └── SOURCE_RULES    // 全源码匹配（需要上下文）
```

### 8.3 Frontmatter 输入净化

```typescript
// brew formula 正则白名单
const BREW_FORMULA_PATTERN = /^[A-Za-z0-9][A-Za-z0-9@+._/-]*$/;

// npm spec 校验
function normalizeSafeNpmSpec(raw) {
  if (validateRegistryNpmSpec(spec) !== null) return undefined;  // 无效
  return spec;
}

// URL 校验：仅允许 http/https 协议
function normalizeSafeDownloadUrl(raw) {
  const parsed = new URL(value);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
}
```

---

## 9. 插件集成

### 9.1 插件声明 Skill

插件通过 manifest 的 `skills` 字段声明其提供的 Skill 目录：

```json
{
  "id": "feishu",
  "skills": ["skills/feishu-doc", "skills/feishu-drive"]
}
```

### 9.2 加载流程

```typescript
function resolvePluginSkillDirs({ workspaceDir, config }) {
  const registry = loadPluginManifestRegistry({ workspaceDir, config });

  for (const record of registry.plugins) {
    // 1. 检查插件是否激活
    if (!resolveEffectivePluginActivationState(record)) continue;

    // 2. 路径安全：Skill 目录必须在插件根目录内
    if (!isPathInsideWithRealpath(record.rootDir, candidate)) continue;

    // 3. 去重
    resolved.push(candidate);
  }
  return resolved;
}
```

---

## 10. 热更新机制

### 10.1 文件监视器

```typescript
// 仅监视 SKILL.md 文件，避免遍历大型目录树
const watchTargets = [
  `${globRoot}/SKILL.md`,      // 根目录本身是 Skill
  `${globRoot}/*/SKILL.md`,    // 标准布局：子目录/SKILL.md
];

// 使用 chokidar 监视
chokidar.watch(watchTargets, {
  ignoreInitial: true,
  awaitWriteFinish: { stabilityThreshold: debounceMs },
  ignored: [/\.git/, /node_modules/, /dist/, /\.venv/, /build/],
});
```

### 10.2 快照版本控制

```typescript
// 文件变更 → 版本号递增
watcher.on("change", (path) => {
  bumpSkillsSnapshotVersion({
    workspaceDir,
    reason: "watch",
    changedPath: path,
  });
});

// 下次 Agent 运行时检测到版本变化 → 重新构建快照
if (shouldRefreshSnapshotForVersion(currentVersion, snapshotVersion)) {
  snapshot = buildWorkspaceSkillSnapshot(workspaceDir, { snapshotVersion });
}
```

---

## 11. 关键设计模式总结

### 11.1 确定性排序

所有 Map/Set/列表在进入 model prompt 前强制排序：

```typescript
.sort((a, b) => a.name.localeCompare(b.name, "en"))
```

这是 **prompt cache 友好** 的关键设计——确定性输入产生确定性 prompt，最大化缓存命中率。

### 11.2 路径安全三重检查

```
symlink → realpath 解析 → isPathInside 验证 → 逃逸警告
```

确保 Skill 文件不会通过符号链接逃逸到配置目录之外。

### 11.3 引用计数环境变量

```typescript
// 多个 Skill 可能注入同一个 env key
activeSkillEnvEntries.get(key).count++;

// 只有最后一个 Skill 释放时才恢复 baseline
if (active.count === 0) {
  delete process.env[key];  // 或恢复 baseline
}
```

### 11.4 渐进式降级

```
完整格式 → compact 格式（省略 description） → 二分截断
```

在 Token 预算内最大化 Skill 覆盖面。

---

## 12. 实现检查清单

如果你要在自己的项目中实现类似的 Skills 系统，以下是关键步骤：

### 基础设施

- [ ] 定义 `Skill` 类型：name, description, filePath, baseDir
- [ ] 定义 `SkillMetadata` 类型：OS, requires, install 规范
- [ ] 设计 Skill 目录结构：`<root>/<skill-name>/SKILL.md`
- [ ] 实现 YAML frontmatter 解析器

### 加载系统

- [ ] 实现多来源目录扫描（内置/工作区/用户/插件）
- [ ] 实现优先级合并（Map 去重，后者覆盖前者）
- [ ] 实现路径安全检查（realpath + isPathInside）
- [ ] 实现文件大小限制
- [ ] 实现确定性排序

### 门控与过滤

- [ ] 实现 OS 过滤
- [ ] 实现二进制依赖检查（which/where）
- [ ] 实现环境变量依赖检查
- [ ] 实现配置依赖检查
- [ ] 实现 Agent 级 allowlist
- [ ] 实现全局 enable/disable 开关

### Prompt 集成

- [ ] 设计 XML 格式的 Skill 列表模板
- [ ] 实现路径压缩（节省 Token）
- [ ] 实现 Token/字符预算管理
- [ ] 实现三级降级策略（full → compact → truncate）
- [ ] 实现会话级快照缓存

### 安全

- [ ] 实现第三方 Skill 安装前安全扫描
- [ ] 定义 critical/warn 规则集
- [ ] 实现 frontmatter 输入净化（正则白名单）
- [ ] 实现环境变量注入的安全限制（黑名单/白名单）
- [ ] 实现引用计数的环境变量作用域管理

### 生命周期

- [ ] 实现安装系统（brew/node/go/download）
- [ ] 实现文件监视器（chokidar/fs.watch）
- [ ] 实现版本化快照刷新
- [ ] 实现防抖更新通知

### 插件集成

- [ ] 设计插件 manifest 中的 skills 声明
- [ ] 实现插件 Skill 目录解析与路径安全验证
- [ ] 实现插件激活状态与 Skill 可见性联动

---

## 13. 文件索引

| 文件 | 职责 |
|------|------|
| `src/agents/skills/types.ts` | 核心类型定义 |
| `src/agents/skills/skill-contract.ts` | Skill 基础类型、prompt 格式化 |
| `src/agents/skills/frontmatter.ts` | YAML frontmatter 解析、输入净化 |
| `src/agents/skills/local-loader.ts` | 本地目录扫描与文件读取 |
| `src/agents/skills/workspace.ts` | 工作区加载管线、合并、预算管理、快照 |
| `src/agents/skills/config.ts` | 配置解析、门控逻辑 |
| `src/agents/skills/filter.ts` | Skill 过滤器标准化 |
| `src/agents/skills/agent-filter.ts` | Agent 级 allowlist 解析 |
| `src/agents/skills/env-overrides.ts` | 环境变量注入与恢复 |
| `src/agents/skills/plugin-skills.ts` | 插件 Skill 目录解析 |
| `src/agents/skills/refresh.ts` | 文件监视与热更新 |
| `src/agents/skills/bundled-dir.ts` | 内置 Skill 目录解析 |
| `src/agents/skills/command-specs.ts` | Slash command 规格定义 |
| `src/config/types.skills.ts` | 配置类型定义 |
| `src/security/skill-scanner.ts` | 安全扫描器 |
| `skills/*/SKILL.md` | 内置 Skill 定义 |
