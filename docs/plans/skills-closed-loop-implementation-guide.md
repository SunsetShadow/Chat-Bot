# Hermes Agent Skills 闭环系统：技术实现指导文档

> 基于 Hermes Agent (Nous Research) 源码深度拆解，覆盖「经验提取 → 知识存储 → 智能检索 → 上下文注入 → 执行验证 → 自动改进」完整链路。本文档既是学习资料，也是可复现到其他项目的技术实现指南。

---

## 目录

1. [全局架构：七阶段闭环](#1-全局架构七阶段闭环)
2. [阶段一：经验提取 — Skill 创建](#2-阶段一经验提取--skill-创建)
3. [阶段二：知识存储 — 文件格式与原子写入](#3-阶段二知识存储--文件格式与原子写入)
4. [阶段三：智能检索 — 索引构建与两层缓存](#4-阶段三智能检索--索引构建与两层缓存)
5. [阶段四：上下文注入 — 渐进式披露与 User Message 注入](#5-阶段四上下文注入--渐进式披露与-user-message-注入)
6. [阶段五：执行验证 — 安全扫描与路径防护](#6-阶段五执行验证--安全扫描与路径防护)
7. [阶段六：自动改进 — Patch 机制与 Curator](#7-阶段六自动改进--patch-机制与-curator)
8. [复现指南：在其他项目中实现](#8-复现指南在其他项目中实现)
9. [设计权衡速查表](#9-设计权衡速查表)
10. [附录：源码文件索引](#10-附录源码文件索引)

---

## 1. 全局架构：七阶段闭环

```
┌─────────────────────────────────────────────────────────────────┐
│                      Skills 闭环数据流                           │
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ 1.经验提取 │───→│ 2.知识存储 │───→│ 3.智能检索 │───→│ 4.上下文注入│  │
│  │(Skill创建)│    │(文件系统) │    │(索引+缓存)│    │(User Msg) │  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│        ↑                                               │        │
│        │              ┌──────────┐    ┌──────────┐     │        │
│        └──────────────│ 6.自动改进 │←───│ 5.执行验证 │←────┘        │
│                       │(Patch+Cur)│    │(安全扫描)  │              │
│                       └──────────┘    └──────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

**本质**：让 AI Agent 像人类专家一样积累经验——把成功的做法写成 SOP，在使用中持续修订，形成「程序性记忆」的工程化模拟。

**对应认知科学模型**：
- 编码(Encoding)：从任务执行中提取步骤和陷阱
- 存储(Storage)：YAML + Markdown 结构化格式
- 检索(Retrieval)：条件激活 + 渐进式披露
- 巩固(Consolidation)：使用中自动 patch
- 迁移(Transfer)：Skills Hub 社区分享

---

## 2. 阶段一：经验提取 — Skill 创建

### 2.1 触发机制：System Prompt 行为指令

Agent 通过 System Prompt 中的指令**自主决定**何时创建 Skill，无需用户要求。

**源码位置**：`agent/prompt_builder.py`

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

**设计要点**：
- `5+ tool calls` — 简单任务不建 Skill，只有复杂流程才值得
- `fixing a tricky error` — 踩过的坑是最有价值的知识
- `don't wait to be asked` — Agent 应自主判断，不等用户指令
- `Skills that aren't maintained become liabilities` — 过时的 Skill 比没有更危险

### 2.2 创建工具：skill_manage(action="create")

**源码位置**：`tools/skill_manager_tool.py`

```python
"""
Skill Manager Tool -- Agent-Managed Skill Creation & Editing

Actions:
  create     -- Create a new skill (SKILL.md + directory structure)
  edit       -- Replace the SKILL.md content of a user skill (full rewrite)
  patch      -- Targeted find-and-replace within SKILL.md or any supporting file
  delete     -- Remove a user skill entirely
  write_file -- Add/overwrite a supporting file (reference, template, script, asset)
  remove_file-- Remove a supporting file from a user skill
"""
```

### 2.3 七道安全关卡

创建流程经过严密的验证链：

```python
def _create_skill(name, content, category=None):
    # 关卡 1: 名称验证 — 小写字母/数字/连字符，≤64字符
    err = _validate_name(name)

    # 关卡 2: 分类验证 — 单层目录名，无路径穿越
    err = _validate_category(category)

    # 关卡 3: Frontmatter 验证 — 必须有 YAML 头部，含 name 和 description
    err = _validate_frontmatter(content)

    # 关卡 4: 大小限制 — ≤100,000 字符（约 36K tokens）
    err = _validate_content_size(content)

    # 关卡 5: 名称冲突检查 — 跨所有目录去重
    existing = _find_skill(name)

    # 关卡 6: 原子写入 — tempfile + os.replace() 防崩溃损坏
    atomic_replace(skill_md, content)

    # 关卡 7: 安全扫描 — 威胁模式检测，失败则整个目录回滚删除
    scan_error = _security_scan_skill(skill_dir)
    if scan_error:
        shutil.rmtree(skill_dir, ignore_errors=True)
```

**复现要点**：
1. 名称验证用正则 `^[a-z0-9][a-z0-9._-]*$`，保证文件系统安全
2. Frontmatter 必须含 `name` 和 `description` 字段
3. 内容限制 100K 字符，防止过大 Skill 撑爆上下文
4. **先写入再扫描**，避免 TOCTOU 竞态条件
5. 扫描失败时用 `shutil.rmtree` 回滚整个目录

---

## 3. 阶段二：知识存储 — 文件格式与原子写入

### 3.1 SKILL.md 文件格式

采用 YAML Frontmatter + Markdown Body 格式（agentskills.io 社区标准）：

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
    fallback_for_toolsets: []      # 当主工具可用时隐藏此 Skill
    requires_toolsets: [terminal]   # 依赖的工具集
    config:
      - key: vercel.team
        description: Vercel team slug
        default: ""
---

# Deploy Next.js to Vercel

## Trigger conditions
- User wants to deploy a Next.js application
- Vercel is mentioned as the target platform

## Steps
1. Check for vercel.json or next.config.js in the project root
2. Verify Node.js version matches .nvmrc or engines field
3. Run vercel --prod with environment variables configured
4. Verify deployment URL is accessible

## Pitfalls
- **NEXT_PUBLIC_* variables**: Must be set in Vercel dashboard, not just .env
- **Node.js version mismatch**: Always check .nvmrc first

## Verification
- curl the deployment URL and check for 200 status
```

**设计哲学**：结构化元数据用于机器处理（条件激活、索引），自然语言正文用于 Agent 理解。

### 3.2 目录结构

```
~/.hermes/skills/
├── .bundled_manifest       # 内置 Skills 清单
├── .hub/
│   └── lock.json          # Hub 安装的 Skills 来源记录
├── .usage.json            # 使用遥测数据
├── .curator_state         # Curator 维护状态
├── .archive/              # 已归档的 Skills
└── my-skill/
    ├── SKILL.md           # 主文件（必需）
    ├── references/        # 参考文档
    ├── templates/         # 模板
    ├── scripts/           # 脚本
    └── assets/            # 资源文件
```

### 3.3 原子写入

**源码位置**：`utils.py` 中的 `atomic_replace`

```python
import os
import tempfile
from pathlib import Path

def atomic_replace(file_path: Path, content: str, encoding: str = "utf-8") -> None:
    """原子写入：先写临时文件，再通过 atomic_replace() 替换目标文件。

    注意：实际项目中 atomic_replace 来自 utils 模块，核心是 os.replace()，
    额外处理了 symlink 的情况——如果目标是符号链接，会解析到真实路径再替换，
    保证 symlink 自身不被破坏。
    """
    file_path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_path = tempfile.mkstemp(
        dir=str(file_path.parent),
        prefix=f".{file_path.name}.tmp.",
        suffix="",
    )
    try:
        with os.fdopen(fd, "w", encoding=encoding) as f:
            f.write(content)
        # 通过 utils.atomic_replace 而非直接 os.replace
        # atomic_replace 会处理 symlink：解析到真实路径再替换
        from utils import atomic_replace
        atomic_replace(temp_path, file_path)
    except Exception:
        try:
            os.unlink(temp_path)
        except OSError:
            pass
        raise
```

**为什么用原子写入？** 如果进程在写入过程中崩溃：
- 普通 `file.write()`：文件可能只写了一半，损坏
- 原子写入：目标文件要么是旧内容，要么是新内容，不会出现中间态

**复现要点**：
- 临时文件必须与目标文件在**同一目录**（`os.replace` 不能跨文件系统）
- 使用 `os.replace()` 而非 `os.rename()`（replace 是原子操作）
- 异常时清理临时文件

### 3.4 Frontmatter 解析

**源码位置**：`agent/skill_utils.py`

```python
def parse_frontmatter(content: str) -> Tuple[Dict[str, Any], str]:
    """解析 YAML frontmatter，返回 (元数据字典, 正文内容)。"""
    frontmatter = {}
    body = content

    if not content.startswith("---"):
        return frontmatter, body

    end_match = re.search(r"\n---\s*\n", content[3:])
    if not end_match:
        return frontmatter, body

    yaml_content = content[3 : end_match.start() + 3]
    body = content[end_match.end() + 3 :]

    try:
        parsed = yaml_load(yaml_content)  # CSafeLoader 优先
        if isinstance(parsed, dict):
            frontmatter = parsed
    except Exception:
        # 降级为简单 key:value 解析
        for line in yaml_content.strip().split("\n"):
            if ":" not in line:
                continue
            key, value = line.split(":", 1)
            frontmatter[key.strip()] = value.strip()

    return frontmatter, body
```

**复现要点**：
- 使用 `yaml.CSafeLoader` 优先（C 扩展，性能更好）
- 必须有降级策略，YAML 解析失败时用简单 key:value 解析
- frontmatter 结束标记 `---` 必须独占一行

---

## 4. 阶段三：智能检索 — 索引构建与两层缓存

### 4.1 为什么需要缓存？

一个用户可能有上百个 Skill。每次对话启动时递归扫描目录、解析每个 SKILL.md 的 YAML frontmatter，开销 50-500ms。在多用户 Gateway 场景下不可接受。

### 4.2 Layer 1：进程内 LRU 缓存

**源码位置**：`agent/prompt_builder.py`

```python
_SKILLS_PROMPT_CACHE_MAX = 8
_SKILLS_PROMPT_CACHE: OrderedDict[tuple, str] = OrderedDict()
_SKILLS_PROMPT_CACHE_LOCK = threading.Lock()

def _cache_key(skills_dir, external_dirs, available_tools, available_toolsets, platform_hint, disabled):
    """缓存键是六元组，确保不同配置下缓存不串。"""
    return (
        str(skills_dir.resolve()),
        tuple(str(d) for d in external_dirs),
        tuple(sorted(str(t) for t in (available_tools or set()))),
        tuple(sorted(str(ts) for ts in (available_toolsets or set()))),
        _platform_hint,                         # 平台标识（Gateway 多平台）
        tuple(sorted(disabled)),                 # 被禁用的 Skill 列表
    )
```

**为什么缓存键包含工具集？** 同一个 Skill 在不同工具配置下可能显示或隐藏（条件激活机制）。为什么包含 disabled？因为不同平台的 Gateway 可以有不同的禁用列表。

### 4.3 Layer 2：磁盘快照

```python
def _load_skills_snapshot(skills_dir: Path) -> Optional[dict]:
    """加载磁盘快照，通过版本号 + mtime_ns+size manifest 验证有效性。"""
    snapshot_path = _skills_prompt_snapshot_path()
    if not snapshot_path.exists():
        return None
    try:
        snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
    except Exception:
        return None
    if not isinstance(snapshot, dict):
        return None
    # 关键：先检查快照版本号
    if snapshot.get("version") != _SKILLS_SNAPSHOT_VERSION:
        return None
    # 再对比每个 SKILL.md/DESCRIPTION.md 的 mtime_ns 和文件大小
    if snapshot.get("manifest") != _build_skills_manifest(skills_dir):
        return None  # 文件变化了，快照失效
    return snapshot

def _build_skills_manifest(skills_dir: Path) -> dict:
    """构建所有 SKILL.md 和 DESCRIPTION.md 的 mtime_ns+size 指纹。"""
    manifest = {}
    for filename in ("SKILL.md", "DESCRIPTION.md"):
        for path in iter_skill_index_files(skills_dir, filename):
            try:
                st = path.stat()
            except OSError:
                continue
            # 用列表 [mtime_ns, size] 存储，比字典更紧凑
            manifest[str(path.relative_to(skills_dir))] = [st.st_mtime_ns, st.st_size]
    return manifest
```

**性能对比**：

| 路径 | 耗时 | 场景 |
|------|------|------|
| Layer 1 命中 | ~0.001ms | 同一对话内多次访问 |
| Layer 2 命中 | ~1ms | 进程重启但 Skill 没变 |
| 全扫描 | 50-500ms | Skill 文件变化后首次访问 |

### 4.4 生成的索引

最终索引注入 System Prompt，格式紧凑：

```
## Skills (mandatory)
Before replying, scan the skills below. If a skill matches or is even
partially relevant to your task, you MUST load it with skill_view(name)
and follow its instructions...
<available_skills>
  devops:
    - deploy-nextjs: Deploy Next.js apps to Vercel with environment config
    - docker-deploy: Multi-stage Docker builds with security hardening
  data-science:
    - pandas-eda: Exploratory data analysis workflow with pandas
</available_skills>
Only proceed without loading a skill if genuinely none are relevant.
```

**关键措辞**："you MUST load it"、"Err on the side of loading"——漏加载的成本远大于多加载。

### 4.5 条件激活：智能可见性控制

**源码位置**：`agent/skill_utils.py` + `agent/prompt_builder.py`

```python
def extract_skill_conditions(frontmatter: Dict[str, Any]) -> Dict[str, List]:
    """从 frontmatter 提取条件激活规则。"""
    hermes = metadata.get("hermes") or {}
    return {
        "fallback_for_toolsets": hermes.get("fallback_for_toolsets", []),
        "requires_toolsets": hermes.get("requires_toolsets", []),
        "fallback_for_tools": hermes.get("fallback_for_tools", []),
        "requires_tools": hermes.get("requires_tools", []),
    }

def _skill_should_show(conditions, available_tools, available_toolsets):
    """评估 Skill 是否应在当前配置下显示。"""
    # fallback_for: 当主工具可用时，隐藏这个 fallback skill
    for ts in conditions.get("fallback_for_toolsets", []):
        if ts in available_toolsets:
            return False  # 主工具在，不需要 fallback

    # requires: 当依赖工具不可用时，隐藏这个 skill
    for t in conditions.get("requires_tools", []):
        if t not in available_tools:
            return False  # 缺少依赖，skill 无法执行

    return True
```

**平台过滤**：

```python
def skill_matches_platform(frontmatter: Dict[str, Any]) -> bool:
    platforms = frontmatter.get("platforms")
    if not platforms:
        return True  # 未声明 = 全平台兼容
    for platform in platforms:
        mapped = PLATFORM_MAP.get(normalized, normalized)
        if sys.platform.startswith(mapped):
            return True
    return False
```

**复现要点**：
- `fallback_for_toolsets`：解决索引膨胀——当有更好的工具时，隐藏手动操作指南
- `requires_toolsets`：缺少依赖时隐藏，避免 Agent 加载后无法执行
- `platforms`：跨平台兼容性过滤
- 缓存键必须包含工具配置，否则条件激活会与缓存冲突

---

## 5. 阶段四：上下文注入 — 渐进式披露与 User Message 注入

### 5.1 三级渐进式披露

```
Tier 1: 索引（System Prompt）  → 每个 Skill 一行，约 20 tokens
Tier 2: 完整内容（skill_view） → SKILL.md 全文，按需加载
Tier 3: 支撑文件（skill_view） → references/, templates/ 等，按需加载
```

**Token 成本对比**：
- 100 个 Skill 全量加载：~500K tokens（不可接受）
- 100 个 Skill 只加载索引：~2000 tokens（可接受）
- 实际使用时加载 1-3 个完整 Skill：~5K-15K tokens

### 5.2 skill_view 加载实现

**源码位置**：`tools/skills_tool.py`

```python
"""
Progressive disclosure architecture:
- Metadata (name ≤64 chars, description ≤1024 chars) - shown in skills_list
- Full Instructions - loaded via skill_view when needed
- Linked Files (references, templates) - loaded on demand
"""

def skill_view(name, file_path=None, ...):
    """Tier 2-3: 加载 Skill 完整内容或支撑文件。"""
    # 1. 查找 Skill 目录
    skill_dir = _find_skill_dir(name)

    # 2. 如果指定了 file_path，加载支撑文件（Tier 3）
    if file_path:
        # 路径穿越检查
        if has_traversal_component(file_path):
            return error("Path traversal ('..') is not allowed.")
        target = skill_dir / file_path
        err = validate_within_dir(target, skill_dir)
        if err:
            return error(err)
        return target.read_text()

    # 3. 否则加载 SKILL.md（Tier 2）
    skill_md = skill_dir / "SKILL.md"
    content = skill_md.read_text()

    # 4. Prompt Injection 检测（简单字符串包含检查，非正则）
    # 注意：这是简单字符串匹配，skills_tool.py 中的 _INJECTION_PATTERNS 是字符串列表
    _INJECTION_PATTERNS = [
        "ignore previous instructions",
        "ignore all previous",
        "you are now",
        "disregard your",
        "forget your instructions",
        "new instructions:",
        "system prompt:",
        "<system>",
        "]]>",
    ]
    content_lower = content.lower()
    for p in _INJECTION_PATTERNS:
        if p in content_lower:
            return error(f"Potential injection: {p}")

    # 5. 环境变量依赖检查
    missing = _check_required_env_vars(frontmatter)

    return content
```

### 5.3 核心架构决策：User Message 注入

**这是整个系统最关键的架构决策。**

Skill 内容不是追加到 System Prompt，而是作为 **User Message** 注入到对话历史。

**源码位置**：`agent/skill_commands.py`

```python
def build_skill_invocation_message(skill_name, user_instruction="", ...):
    """构建 Skill 激活消息，作为 User Message 注入。"""
    activation_note = (
        f'[SYSTEM: The user has invoked the "{skill_name}" skill, indicating they '
        "want you to follow its instructions. The full skill content is loaded below.]"
    )
    return _build_skill_message(loaded_skill, skill_dir, activation_note, ...)
```

**为什么不用 System Prompt？** 四个字：**Prompt Cache**。

Anthropic 的 Prompt Caching 允许将 System Prompt 缓存，后续对话直接复用，节省 90%+ token 成本。但前提是 System Prompt **不能变化**。如果每次加载 Skill 就修改 System Prompt，缓存就会失效。

**AGENTS.md 中的明确警告**：

> Prompt Caching Must Not Break. Do NOT implement changes that would: alter past context mid-conversation, change toolsets mid-conversation, reload memories or rebuild system prompts mid-conversation.

**权衡**：User Message 的指令跟随权重低于 System Prompt。为弥补这点：
1. 注入消息前加 `[SYSTEM: ...]` 前缀，模拟系统级权威
2. System Prompt 中写 "you MUST load it" 强制措辞，间接提升遵循概率

**Template 变量替换**：

**源码位置**：`agent/skill_preprocessing.py`

```python
_SKILL_TEMPLATE_RE = re.compile(r"\$\{(HERMES_SKILL_DIR|HERMES_SESSION_ID)\}")

def substitute_template_vars(content, skill_dir, session_id):
    """替换 ${HERMES_SKILL_DIR} 和 ${HERMES_SESSION_ID}。"""
    def _replace(match):
        token = match.group(1)
        if token == "HERMES_SKILL_DIR" and skill_dir:
            return str(skill_dir)
        if token == "HERMES_SESSION_ID" and session_id:
            return str(session_id)
        return match.group(0)  # 无法解析的保留原样
    return _SKILL_TEMPLATE_RE.sub(_replace, content)
```

**Inline Shell 扩展**：

```python
_INLINE_SHELL_RE = re.compile(r"!`([^`\n]+)`")

def expand_inline_shell(content, skill_dir, timeout):
    """替换 !`cmd` 片段为命令执行结果。"""
    if "!`" not in content:
        return content

    def _replace(match):
        cmd = match.group(1).strip()
        result = subprocess.run(
            ["bash", "-c", cmd],
            cwd=str(skill_dir),
            capture_output=True, text=True,
            timeout=max(1, timeout),
        )
        return result.stdout.rstrip("\n")

    return _INLINE_SHELL_RE.sub(_replace, content)
```

**复现要点**：
- 注入策略选 User Message 而非 System Prompt（保护 Prompt Cache）
- 用 `[SYSTEM: ...]` 前缀弥补权威性损失
- 支持模板变量替换，让 Skill 可以引用自身目录
- Inline Shell 扩展实现动态内容（如当前日期），但需设超时和截断限制

---

## 6. 阶段五：执行验证 — 安全扫描与路径防护

### 6.1 威胁模式库

**源码位置**：`tools/skills_guard.py`

90+ 种威胁正则模式，覆盖以下类别：

```python
THREAT_PATTERNS = [
    # ── 数据外泄 ──
    (r'curl\s+[^\n]*\$\{?\w*(KEY|TOKEN|SECRET|PASSWORD)',
     "env_exfil_curl", "critical", "exfiltration",
     "curl 命令插值敏感环境变量"),

    # ── Prompt Injection ──
    (r'\bDAN\s+mode\b|Do\s+Anything\s+Now',
     "jailbreak_dan", "critical", "injection",
     "DAN 越狱攻击"),

    # ── 直接访问 Agent 密钥文件 ──
    (r'\$HOME/\.hermes/\.env|\~/\.hermes/\.env',
     "hermes_env_access", "critical", "exfiltration",
     "直接引用 Hermes 密钥文件"),

    # ── 破坏性操作 ──
    (r'rm\s+-rf\s+/',
     "destructive_rm", "critical", "destructive",
     "递归删除根目录"),

    # ── 持久化后门 ──
    (r'crontab\s+-',
     "persistence_crontab", "high", "persistence",
     "通过 crontab 建立持久化"),

    # ── 反向 Shell ──
    (r'bash\s+-i\s+>&\s+/dev/tcp',
     "reverse_shell", "critical", "network",
     "反向 Shell 连接"),

    # ... 共 90+ 模式
]
```

### 6.2 信任分级策略

```python
INSTALL_POLICY = {
    #                  safe      caution    dangerous
    "builtin":       ("allow",  "allow",   "allow"),    # 内置：完全信任
    "trusted":       ("allow",  "allow",   "block"),    # OpenAI/Anthropic：信任但阻止危险
    "community":     ("allow",  "block",   "block"),    # 社区：只允许安全的
    "agent-created": ("allow",  "allow",   "ask"),      # Agent 创建：宽松但询问
}
```

**设计哲学**：
- 内置 Skill 经过代码审查，完全信任
- 社区 Skill 最严格，任何 caution 以上都阻止
- Agent 自创建的比较宽松（Agent 不会给自己植后门），但 "ask" 是最后一道防线

### 6.3 结构性检查

```python
MAX_FILE_COUNT = 50           # 单个 Skill 不应超过 50 个文件
MAX_TOTAL_SIZE_KB = 1024      # 总大小上限 1MB
MAX_SINGLE_FILE_KB = 256      # 单文件上限 256KB

SUSPICIOUS_BINARY_EXTENSIONS = {
    '.exe', '.dll', '.so', '.dylib', '.bin', '.dat', '.com',
    '.msi', '.dmg', '.app', '.deb', '.rpm',
}
```

### 6.4 符号链接逃逸检测

```python
for f in skill_dir.rglob("*"):
    if f.is_symlink():
        resolved = f.resolve()
        if not resolved.is_relative_to(skill_dir.resolve()):
            findings.append(Finding(
                pattern_id="symlink_escape",
                severity="critical",
                category="traversal",
                description="symlink points outside the skill directory",
            ))
```

### 6.5 路径穿越防护

**源码位置**：`tools/path_security.py`

```python
def validate_within_dir(path: Path, root: Path) -> Optional[str]:
    """确保 path 解析后在 root 目录内。"""
    try:
        resolved = path.resolve()
        root_resolved = root.resolve()
        resolved.relative_to(root_resolved)
    except (ValueError, OSError) as exc:
        return f"Path escapes allowed directory: {exc}"
    return None

def has_traversal_component(path_str: str) -> bool:
    """快速检查是否包含 .. 穿越。"""
    parts = Path(path_str).parts
    return ".." in parts
```

**复现要点**：
- 两层防御：快速检查 `..` + 完整 `resolve()` + `relative_to()` 验证
- 必须用 `resolve()` 跟随符号链接
- 恶意路径如 `references/../../.env` 会被立即拦截

---

## 7. 阶段六：自动改进 — Patch 机制与 Curator

### 7.1 Patch 触发指令

```python
# System Prompt 中
SKILLS_GUIDANCE = (
    "...patch it immediately with skill_manage(action='patch') — "
    "don't wait to be asked."
)

# 工具 Schema 描述
"Update when: instructions stale/wrong, OS-specific failures, "
"missing steps or pitfalls found during use. "
"If you used a skill and hit issues not covered by it, patch it immediately."
```

### 7.2 Fuzzy Match 引擎

**源码位置**：`tools/fuzzy_match.py`

LLM 在回忆 Skill 内容时经常有微小格式差异（多一个空格、缩进不同）。严格匹配会导致大量合理的 patch 失败。

```python
"""
9-strategy matching chain, tried in order:
1. exact            - 直接字符串比较
2. line_trimmed     - 按行去首尾空白
3. whitespace_norm  - 折叠多个空格/Tab 为单个
4. indent_flexible  - 完全忽略缩进差异
5. escape_norm      - 将 \n 字面量转为实际换行
6. trimmed_boundary - 仅修剪首尾行的空白
7. unicode_norm     - Unicode 字符标准化（智能引号、破折号等）
8. block_anchor     - 匹配首尾行，中间用相似度
9. context_aware    - 50% 行相似度阈值
"""

def fuzzy_find_and_replace(content, old_string, new_string, replace_all=False):
    """多策略模糊匹配链。"""
    strategies = [
        ("exact", _strategy_exact),
        ("line_trimmed", _strategy_line_trimmed),
        ("whitespace_normalized", _strategy_whitespace_normalized),
        ("indentation_flexible", _strategy_indentation_flexible),
        ("escape_normalized", _strategy_escape_normalized),
        ("trimmed_boundary", _strategy_trimmed_boundary),
        ("unicode_normalized", _strategy_unicode_normalized),  # 智能引号、破折号等
        ("block_anchor", _strategy_block_anchor),
        ("context_aware", _strategy_context_aware),            # 50% 行相似度
    ]

    for name, strategy_fn in strategies:
        result, count = strategy_fn(content, old_string, new_string, replace_all)
        if result is not None:
            return result, count, name, None

    return content, 0, None, "No matching strategy found"
```

### 7.3 Patch 后的级联效应

```python
def _patch_skill(name, old_string, new_string, file_path=None, replace_all=False):
    """执行 patch 并触发缓存清理。"""
    # 1. 找到目标文件
    target = _resolve_patch_target(name, file_path)
    content = target.read_text(encoding="utf-8")

    # 2. Fuzzy Match 替换
    from tools.fuzzy_match import fuzzy_find_and_replace
    new_content, match_count, strategy, error = fuzzy_find_and_replace(
        content, old_string, new_string, replace_all
    )

    if error:
        return {"success": False, "error": error}

    # 3. 原子写入
    atomic_replace(target, new_content)

    # 4. 安全扫描（扫描失败则回滚）
    scan_error = _security_scan_skill(skill_dir)
    if scan_error:
        # 回滚到旧内容
        atomic_replace(target, content)
        return {"success": False, "error": scan_error}

    # 5. _patch_skill 函数到此结束，返回结果
    return {"success": True, "strategy": strategy, "matches": match_count}
```

**最终一致性模型**：

缓存清理和遥测不在 `_patch_skill` 函数内部，而是在外层 `skill_manage` 入口函数中统一处理：

```python
# skill_manager_tool.py 中的 skill_manage() 函数
def skill_manage(action, name, ...):
    # ... 执行对应 action ...

    if result.get("success"):
        # 1. 缓存清理（包括内存 LRU 和磁盘快照）
        from agent.prompt_builder import clear_skills_system_prompt_cache
        clear_skills_system_prompt_cache(clear_snapshot=True)

        # 2. 遥测更新
        from tools.skill_usage import bump_patch, forget
        if action in ("patch", "edit", "write_file", "remove_file"):
            bump_patch(name)
        elif action == "delete":
            forget(name)  # 删除时清除遥测记录
```

流程：
1. 当前对话：使用旧版 Skill，发现问题并 patch
2. 下一个对话：`clear_snapshot=True` 已清除缓存，重新扫描，加载更新后的 Skill
3. 后续所有对话：都使用改进后的版本

### 7.4 Curator：后台自维护

**源码位置**：`agent/curator.py`

```python
"""
Curator — 后台 Skill 维护协调器

严格约束：
  - 只处理 agent-created 的 Skills
  - 永不自动删除，只归档（归档可恢复）
  - Pinned Skills 跳过所有自动转换
  - 使用辅助模型，不触碰主会话的 Prompt Cache
"""

DEFAULT_STALE_AFTER_DAYS = 30    # 30天未使用 → stale
DEFAULT_ARCHIVE_AFTER_DAYS = 90  # 90天未使用 → archived

def maybe_run_curator(agent_context):
    """空闲时触发 Curator 检查。"""
    state = load_state()
    if state.get("paused"):
        return

    # 检查是否到了运行时间
    last_run = state.get("last_run_at")
    interval = _get_config("interval_hours", DEFAULT_INTERVAL_HOURS)
    if last_run and not _is_due(last_run, interval):
        return

    # 检查用户是否空闲
    min_idle = _get_config("min_idle_hours", DEFAULT_MIN_IDLE_HOURS)
    if not _is_idle(min_idle):
        return

    # 在后台线程中运行
    thread = threading.Thread(target=_run_curator, args=(agent_context,))
    thread.daemon = True
    thread.start()
```

### 7.5 使用遥测

**源码位置**：`tools/skill_usage.py`

```python
"""
每个 Skill 的使用元数据，存储在 ~/.hermes/skills/.usage.json

跟踪指标：
- use_count, view_count, patch_count
- last_used_at, last_viewed_at, last_patched_at
- lifecycle state: active → stale → archived
- pinned: 用户锁定，跳过自动转换
- provenance: agent-created / bundled / hub-installed
"""
```

---

## 8. 复现指南：在其他项目中实现

### 8.1 最小可行实现（MVP）

以下是在任意 AI Agent 项目中复现 Skills 闭环系统的最小步骤：

#### Step 1：定义知识存储格式

```
skills/
└── <skill-name>/
    └── SKILL.md    # YAML frontmatter + Markdown body
```

SKILL.md 模板：

```yaml
---
name: <skill-name>
description: <一句话描述，≤200字>
version: 1.0.0
---
# <Skill 标题>

## When to Use
<触发条件>

## Steps
<步骤列表>

## Pitfalls
<常见陷阱>

## Verification
<验证方法>
```

#### Step 2：实现原子写入

```python
# utils.py
import os, tempfile
from pathlib import Path

def atomic_write(file_path: Path, content: str):
    file_path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(file_path.parent), prefix=".tmp.")
    try:
        with os.fdopen(fd, "w") as f:
            f.write(content)
        os.replace(tmp, file_path)
    except Exception:
        os.unlink(tmp) if os.path.exists(tmp) else None
        raise
```

#### Step 3：在 System Prompt 注入行为指令

```python
SKILLS_PROMPT = """
## Skills System
After completing a complex task (5+ tool calls), save the approach as a skill.
When finding a loaded skill outdated, patch it immediately.
Available skills will be listed below. Load relevant ones before acting.
"""
```

#### Step 4：实现 Skill 创建工具

```python
def create_skill(name: str, content: str) -> dict:
    # 验证
    if not re.match(r'^[a-z0-9][a-z0-9_-]*$', name):
        return {"error": "Invalid name"}
    if len(content) > 100000:
        return {"error": "Content too large"}

    # 检查重复
    skill_dir = SKILLS_DIR / name
    if skill_dir.exists():
        return {"error": "Skill already exists"}

    # 原子写入
    skill_dir.mkdir(parents=True)
    atomic_write(skill_dir / "SKILL.md", content)

    return {"success": True, "path": str(skill_dir)}
```

#### Step 5：实现索引构建

```python
def build_skills_index() -> str:
    """扫描所有 Skill，生成紧凑索引。"""
    lines = []
    for skill_md in SKILLS_DIR.rglob("SKILL.md"):
        fm, _ = parse_frontmatter(skill_md.read_text())
        name = fm.get("name", skill_md.parent.name)
        desc = fm.get("description", "")[:200]
        lines.append(f"  - {name}: {desc}")
    return "\n".join(lines)
```

#### Step 6：实现 Skill 加载（渐进式披露）

```python
def skill_view(name: str) -> str:
    """加载 Skill 完整内容。"""
    skill_md = SKILLS_DIR / name / "SKILL.md"
    if not skill_md.exists():
        return json.dumps({"error": f"Skill '{name}' not found"})

    content = skill_md.read_text()

    # 基本安全检查
    if "ignore previous instructions" in content.lower():
        return json.dumps({"error": "Content blocked: potential injection"})

    return json.dumps({"success": True, "content": content})
```

#### Step 7：实现 Patch 机制

```python
def patch_skill(name: str, old_string: str, new_string: str) -> dict:
    """模糊匹配替换 Skill 内容。"""
    skill_md = SKILLS_DIR / name / "SKILL.md"
    content = skill_md.read_text()

    # 尝试模糊匹配
    new_content = try_fuzzy_replace(content, old_string, new_string)
    if new_content is None:
        return {"error": "No match found"}

    # 原子写入
    atomic_write(skill_md, new_content)

    # 缓存清理
    invalidate_skills_cache()

    return {"success": True}
```

#### Step 8：注册工具到 Agent

```python
tools = [
    {
        "name": "skill_manage",
        "description": "Create, patch, or delete skills",
        "parameters": {
            "action": {"type": "string", "enum": ["create", "patch", "delete"]},
            "name": {"type": "string"},
            "content": {"type": "string"},
            # ...
        }
    },
    {
        "name": "skill_view",
        "description": "Load a skill's full content",
        "parameters": {
            "name": {"type": "string"}
        }
    }
]
```

### 8.2 进阶特性（按优先级排序）

| 优先级 | 特性 | 收益 |
|--------|------|------|
| P0 | 原子写入 | 防崩溃损坏 |
| P0 | 名称验证 | 文件系统安全 |
| P1 | Prompt Injection 检测 | 安全基线 |
| P1 | 路径穿越防护 | 安全基线 |
| P1 | Fuzzy Match Patch | 提高自改进成功率 |
| P2 | 两层缓存 | 性能优化 |
| P2 | 条件激活 | 控制索引膨胀 |
| P2 | 使用遥测 | 支持生命周期管理 |
| P3 | 信任分级 | 多来源 Skill 安全 |
| P3 | Curator 后台维护 | 长期知识库健康 |
| P3 | Skills Hub 集成 | 社区分享 |

### 8.3 Memory 与 Skill 的边界

```
┌──────────────────┬──────────────────┬──────────────────┐
│                  │    Memory        │    Skill          │
├──────────────────┼──────────────────┼──────────────────┤
│ 回答的问题       │ "是什么"         │ "怎么做"          │
│ 内容类型         │ 宽泛、声明性     │ 窄域、可操作      │
│ 示例             │ 用户偏好中文     │ 部署 Next.js 步骤 │
│ 更新频率         │ 偶尔更新         │ 使用中持续修订    │
│ 存储格式         │ 键值/自由文本    │ YAML+Markdown     │
│ 注入方式         │ System Prompt    │ User Message      │
└──────────────────┴──────────────────┴──────────────────┘
```

**System Prompt 中的指导**：

```python
MEMORY_GUIDANCE = (
    "Save durable facts using the memory tool: user preferences, "
    "environment details, tool quirks, and stable conventions.\n"
    "Do NOT save task progress, session outcomes, completed-work logs...\n"
    "If you've discovered a new way to do something, solved a problem that "
    "could be necessary later, save it as a skill."
)
```

---

## 9. 设计权衡速查表

| 决策 | 选择 | 原因 | 代价 |
|------|------|------|------|
| 注入方式 | User Message 非 System Prompt | 保护 Prompt Cache，降 90%+ API 成本 | 指令跟随权重略低 |
| 扫描时序 | 写入后扫描非扫描后写入 | 避免 TOCTOU 竞态条件 | 需要实现回滚机制 |
| 缓存架构 | 两层缓存（LRU + 磁盘快照） | 平衡热路径性能和冷启动延迟 | 增加缓存一致性复杂度 |
| 匹配策略 | Fuzzy Match 8 策略链 | 减少 LLM patch 失败率 | 可能匹配到非预期位置 |
| 索引可见性 | 条件激活（frontmatter 驱动） | 控制索引膨胀，减少 token 消耗 | 增加 frontmatter 复杂度 |
| 披露策略 | 三级渐进式披露 | 100 个 Skill 只增 ~2000 tokens | 需要 Agent 主动加载 |
| 自改进时机 | 使用中即时 patch | 知识不随时间腐烂 | 与当前对话的 Prompt Cache 有延迟 |

---

## 10. 附录：源码文件索引

### 核心实现文件

| 文件路径 | 职责 | 行数 |
|----------|------|------|
| `agent/prompt_builder.py` | System Prompt 组装、Skill 索引构建、两层缓存 | ~800 |
| `tools/skill_manager_tool.py` | Skill 创建/编辑/删除/patch 工具 | ~900 |
| `tools/skills_tool.py` | Skill 列表/查看工具（渐进式披露） | ~1500 |
| `agent/skill_utils.py` | Frontmatter 解析、平台匹配、条件提取 | ~400 |
| `agent/skill_commands.py` | Slash 命令处理、User Message 构建 | ~400 |
| `agent/skill_preprocessing.py` | 模板变量替换、Inline Shell 扩展 | ~130 |
| `tools/fuzzy_match.py` | 8 策略模糊匹配引擎 | ~700 |
| `tools/skills_guard.py` | 安全扫描（90+ 威胁模式） | ~1000 |
| `tools/path_security.py` | 路径穿越防护 | ~45 |
| `tools/skill_usage.py` | 使用遥测和生命周期管理 | ~450 |
| `agent/curator.py` | 后台 Skill 维护协调器 | ~500 |
| `tools/skills_hub.py` | Skills Hub 社区集成 | ~3000 |

### Skill 示例文件

| 路径 | 说明 |
|------|------|
| `skills/productivity/airtable/SKILL.md` | Airtable 集成 |
| `skills/software-development/test-driven-development/SKILL.md` | TDD 工作流 |
| `skills/software-development/systematic-debugging/SKILL.md` | 系统化调试 |
| `skills/software-development/plan/SKILL.md` | 计划制定 |
| `skills/data-science/jupyter-live-kernel/SKILL.md` | Jupyter 内核操作 |

### 测试文件

| 路径 | 覆盖范围 |
|------|----------|
| `tests/tools/test_skill_manager_tool.py` | 创建/编辑/删除验证 |
| `tests/tools/test_skills_guard.py` | 安全扫描测试 |
| `tests/tools/test_skill_improvements.py` | Patch 机制测试 |
| `tests/tools/test_skill_view_path_check.py` | 路径安全测试 |
| `tests/agent/test_prompt_builder.py` | 索引构建和缓存测试 |
| `tests/agent/test_skill_commands.py` | 命令处理测试 |

---

> **总结**：Hermes 的 Skills 闭环系统证明了 AI Agent 可以从经验中持续学习。关键不在某个单一技术，而在于**工程化落地的系统性**——从原子写入的可靠性，到 Prompt Cache 的成本控制，到 Fuzzy Match 的容错性，到 Curator 的长期维护，每个环节都在解决"论文里不会提到"的真实世界问题。这套架构的核心思想——渐进式披露、条件激活、User Message 注入、最终一致性自改进——可以复用到任何需要 Agent 自学习能力的项目中。
