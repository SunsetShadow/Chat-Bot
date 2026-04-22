# CLAUDE.md

本文件为 Claude Code 在此代码仓库中工作时提供指导。

## 项目概述

Vue 3 + NestJS 聊天应用，使用 AI SDK 驱动流式聊天，LangGraph Supervisor 模式编排多 Agent 工作流。支持多 Agent 协作编排（Supervisor 多步路由）、standalone 模式（自定义 Agent 独立运行）、Agent 权限分级（系统内置/系统示例/用户自定义）、工具权限分级、**路径沙箱**（限制工具可访问的目录范围，通过设置中心 UI 配置）、**规则系统**（全局规则强制生效 + 通用规则按需启用，支持按 Agent 分别配置）、**语音系统**（ASR 语音识别 + TTS 文本朗读，腾讯云 API）、AI 记忆提取与语义检索、定时任务系统（含全局通知）、联网搜索意图判断（默认开启，按需调用 web_search）、文件搜索工具（按文件名/内容搜索）、**Avatar 系统**（Live2D 角色交互，PixiJS 6 + Cubism 4，支持语音驱动表情/动作/口型同步）。UI 主题：暗色/亮色双主题，简约清晰风格。

### Agent 管理页（AgentConfigView）

Agent 配置中心使用 NTabs segment 分为「自定义 Agent」和「系统 Agent」两个 tab：
- **自定义 Agent tab**（默认）：展示用户自定义 Agent 和系统示例 Agent，含模板创建/空白创建按钮，支持编辑、复制、删除
- **系统 Agent tab**：展示系统内置 Agent（超级助手、定时任务执行器），只读，无编辑/删除操作；超级助手和定时任务执行器永久拥有所有工具和所有子 Agent 调用权限
- 两个 tab 使用 `v-show` 保持 DOM 挂载，切换无抖动

## 开发命令

```bash
./dev.sh                    # 同时启动前后端
cd backend && pnpm dev      # 后端 :8000 (NestJS)
cd backend && pnpm lint     # 后端 ESLint
cd frontend && pnpm dev     # 前端 https://localhost:3000 (HTTPS, host: true)
cd frontend && pnpm lint    # 前端 ESLint
```

### Docker（数据库等基础设施）

项目支持多设备 Docker 配置，通过 `docker.sh` 自动选择环境：

```bash
./docker.sh up    # 自动检测设备，启动对应配置（NAS → .env.nas，Mac → .env.mac）
./docker.sh down  # 停止所有容器
./docker.sh ps    # 查看容器状态
```

也可手动指定环境文件：

```bash
docker compose --env-file .env.nas up -d   # NAS
docker compose --env-file .env.mac up -d   # Mac
```

配置文件：`.env.nas`（NAS 设备）、`.env.mac`（Mac 设备），参数化控制端口和数据卷路径。

> 前端使用 `@vitejs/plugin-basic-ssl` 提供 HTTPS 开发服务，`host: true` 绑定 `0.0.0.0`。
> iPad 等移动设备通过 `https://<局域网IP>:3000` 访问（首次需信任自签名证书）。
> HTTPS 是语音录制（ASR）的前提条件——iOS Safari 在非 Secure Context 下会拒绝 `getUserMedia`。

## 核心数据流

```
用户输入 → useAIChat.sendMessage()
  → ChatTransport → POST /api/v1/chat/completions
  → ChatController → ChatService → LangGraphService
  → getGraph(preferredAgent):
      standalone Agent?              → 单 Agent 独立图
      preferredAgent + 意图关键词命中? → Fast-path 直接路由到该 Agent（跳过 Supervisor，降低 ~30% 延迟）
      否则?                          → Supervisor 图 (多 Agent 编排，按 capabilities 路由)
  → SSE 流（Supervisor 工具调用/文本/ToolNode 错误均过滤，仅 Worker 结果透传）
       Handoff 计数保护：Agent 切换超过 max_turns（默认 5）时自动终止，防止无限循环
  记忆系统（agent_id 隔离）:
      全局记忆（agent_id=NULL）→ 所有 Agent 可见
      Agent 专属记忆 → 仅该 Agent 可见（通过 prompt hint 引导 LLM 传入 agent_id）
      查询: buildMemoryContext(agentId) → WHERE agent_id = :id OR agent_id IS NULL
    → ChatTransport → UIMessageChunk → Vue 响应式渲染

语音通道（独立于 SSE）:
  TTS: 浏览器 WebSocket ↔ NestJS TtsRelayService ↔ 腾讯云 TTS WebSocket
       AI 流式 chunk → EventEmitter → TtsRelayService → 二进制音频帧 → 浏览器 MediaSource 播放
  ASR: MediaRecorder 录音 → Blob → POST /api/v1/speech/asr → 腾讯云 ASR → 识别文本
       录音面板（波形可视化 + 计时器）通过 Web Audio API AnalyserNode 实时采集音频电平
```

## 环境配置

见 `backend/.env.example`。

## 详细文档

| 文档 | 内容 |
|------|------|
| [docs/specs/development](docs/specs/development/spec.md) | 技术栈版本、目录结构、命名规范、代码风格、关键文件索引 |
| [docs/specs/core-features](docs/specs/core-features/spec.md) | 聊天/Agent/工具/规则/记忆/定时任务/通知系统详细规范（数据模型、API、约束） |
| [docs/specs/message-rendering](docs/specs/message-rendering/spec.md) | 消息渲染规范 |
| [docs/specs/security](docs/specs/security/spec.md) | 安全规范（输入验证、安全头、速率限制、路径沙箱） |
| [docs/plans/](docs/plans/) | 未来演进计划 |

## 已知问题

见 [plans/后续.md](docs/plans/后续.md) 和 [core-features/spec.md](docs/specs/core-features/spec.md) 底部"已知限制"。
