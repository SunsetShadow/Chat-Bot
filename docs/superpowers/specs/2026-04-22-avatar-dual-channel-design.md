# Avatar 双通道渲染架构设计

> 日期: 2026-04-22
> 状态: 已批准
> 前置: Phase 0 已完成（Live2D 渲染、AvatarView 页面、手动控制）

## 1. 核心定位

**Avatar = Supervisor Agent 的视觉化身。** 每个 Agent 对应一个独立 Live2D 角色形象和完整人格。切换 Agent 就是切换角色。Worker Agent 在后台工作，用户只看到 Supervisor 角色的表情和反应。

**人格深度**: 完整人格 + 任务服务 — 角色有设定和个性，但本质是帮用户做事。

## 2. 整体架构

### 数据流

```
用户输入 → useAIChat.sendMessage()
  → ChatTransport → POST /api/v1/chat/completions
  → SSE Stream → MessageDispatcher（新增）
      ├── TextChannel → AI SDK UI UIMessage（现有管线，不变）
      └── AvatarChannel → AvatarPanel
            ├── EmotionParser: Agent 工具调用 → expression index
            ├── MotionPlayer: Agent 工具调用 → Live2D motion
            └── LipSyncPlayer: TTS 音量 → ParamMouthOpenY
```

MessageDispatcher 同时向文本通道和视觉通道分发 SSE 事件。文本通道保持现有 AI SDK UI 管线不变；视觉通道独立消费 avatar 相关事件。

### 新增文件

| 文件 | 职责 |
|------|------|
| `frontend/src/composables/useAvatarChannel.ts` | Avatar 视觉通道 composable |
| `frontend/src/composables/useEmotionParser.ts` | 情绪标签解析 + 映射 |
| `frontend/src/composables/useAvatarLayout.ts` | 布局模式管理 |
| `frontend/src/composables/useUserBehavior.ts` | 用户行为感知 |
| `frontend/src/components/avatar/AvatarPanel.vue` | Avatar 面板（包含 Live2DAvatar + 控制逻辑） |
| `frontend/src/components/avatar/LayoutManager.vue` | 布局管理组件 |
| `frontend/public/live2d/models.json` | 模型注册表 |
| `frontend/src/config/emotion-map.ts` | 默认情绪映射 |
| `backend/src/modules/langgraph/tools/avatar.ts` | Avatar 工具定义 |

### 后端改动

| 文件 | 改动 |
|------|------|
| `chat.service.ts` | SSE 流增加 `avatar_action` 事件类型 |
| `stream-events.ts` | 新增 AvatarAction event type |
| `tool-registry.service.ts` | 注册 avatar 工具分类 |
| `agent.service.ts` | Agent 实体 avatar 字段扩展为 AvatarConfig JSON |

### 不变的部分

- AI SDK UI 的 UIMessage 机制
- useChatTransport 的核心逻辑
- ChatContainer 及所有消息渲染组件

## 3. 情绪驱动：Agent 工具调用模式

### 设计原理

Avatar 是 Supervisor Agent 本身，Agent 通过工具调用自主决定表情和动作。比标签提取模式更精确，因为 Agent 拥有完整对话上下文。

### 流程

```
Supervisor Agent 处理用户消息:
  → LLM 生成文本 + 调用 Avatar 工具:
    - express_emotion("joy")
    - play_motion("greet")
  → 后端处理工具调用:
    - express_emotion → SSE avatar_action 事件
    - play_motion → SSE avatar_action 事件
    - 文本内容 → SSE text 流
  → 前端:
    - AvatarChannel 收到 avatar_action → 执行 Live2D 动画
    - TextChannel 收到 text → 渲染文字
```

### Avatar 工具定义

```typescript
// backend/src/modules/langgraph/tools/avatar.ts

const avatarTools = [
  {
    name: "express_emotion",
    description: "设置角色表情，表达当前情绪",
    parameters: {
      emotion: {
        type: "string",
        enum: ["neutral", "happy", "sad", "angry", "surprised", "sympathetic", "thinking", "excited"],
        description: "要表达的情绪"
      }
    }
  },
  {
    name: "play_motion",
    description: "播放角色动作",
    parameters: {
      group: { type: "string", description: "动作组名" },
      index: { type: "number", description: "动作索引，不填则随机" }
    }
  },
  {
    name: "set_idle_motion",
    description: "开关待机动作",
    parameters: {
      enabled: { type: "boolean" }
    }
  }
];
```

### 人格 Prompt 注入

Agent system prompt 自动追加 Avatar 指令：

```
你是 {name}，一个{traits.join('、')}的虚拟角色。

## 你的视觉形象
你有一个 Live2D 角色形象，用户可以看到你的表情和动作。

## 表情能力
你可以使用以下工具来表达情感：
- express_emotion: 可选表情有 {emotionList}
- play_motion: 可以播放动作来增强表达

## 行为准则
- 在回复时主动使用表情和动作工具，让用户感受到你的情绪
- {speakingStyle}
- 回复要自然，不要提及你是 AI 或语言模型
```

## 4. 布局管理

### 三种布局模式

**悬浮窗模式 (default)**:
- Avatar 以可拖动悬浮窗形式覆盖在 ChatContainer 上
- 可最小化为小图标
- 用户可选择完全隐藏

**并排模式**:
- 左侧 AvatarPanel（40%），右侧 ChatContainer（60%）
- 移动端降级为上下布局
- 分割线可拖动调整比例

**全屏 VN 模式**:
- Avatar 占满背景
- 文字以字幕气泡叠加
- 消息历史折叠为可展开侧边栏
- 适合休闲对话场景

### 实现

- `useAvatarLayout()` composable 管理当前模式
- 模式存储在 localStorage
- CSS transition 切换动画
- 悬浮窗拖拽：mousedown/mousemove/mouseup
- 移动端响应式自动降级

## 5. 感知引擎

### 5.1 对话情绪感知

Agent 本身就是最好的情绪分析器。在 system prompt 中指示 Agent 根据对话氛围主动调用 `express_emotion` 工具。

### 5.2 用户行为感知

| 行为 | 检测方式 | Avatar 反应 |
|------|---------|-------------|
| 长时间未输入 | setTimeout 计时器 | Agent 可选做等待动作 |
| 页面失焦 | `visibilitychange` 事件 | 角色进入待机状态 |
| 快速连续发送 | 消息间隔 < 2s | 角色表现紧张/专注 |
| 打字中 | 正在输入状态检测 | 角色做"倾听"动作 |

实现：`useUserBehavior.ts` composable，在用户发送消息时附带行为上下文（如 `idle_seconds: 300`）传给后端。

### 5.3 内容感知

用户上传图片/文件时，Agent 通过现有工具链处理。Avatar 反应通过 Agent 工具调用自然实现。不需要额外前端内容感知机制。

### 5.4 记忆积累

复用现有 `agent_memory` 表，Avatar 相关记忆通过 `memory_type = 'avatar'` 标记：

| 记忆层 | 内容 | 持久性 | 示例 |
|--------|------|--------|------|
| 用户画像 | 用户偏好、习惯 | 永久 | "用户喜欢简洁回复" |
| 互动历史 | 对话中的关键事件 | 会话级 | "刚帮用户解决了代码问题" |
| 情绪基线 | 用户的情绪倾向 | 滑动窗口 | "最近3次对话情绪偏正面" |

在 Supervisor 的 prompt 中增加"记住用户偏好和互动模式"指令，复用 `extractAndSaveMemory()` 逻辑。

## 6. 人格系统

### AvatarConfig 定义

```typescript
interface AvatarConfig {
  // 模型资源
  modelUrl: string;
  modelSettings: {
    width: number;
    height: number;
    scale: number;
  };

  // 表情映射
  emotionMap: Record<string, number>;  // { "happy": 0, "sad": 1, ... }

  // 人格设定
  personality: {
    name: string;
    traits: string[];            // ["友善", "专业", "幽默"]
    speakingStyle: string;
    greetingMessage: string;
    idleMessages: string[];
  };
}
```

### 存储方式

Agent 实体的 `avatar` 字段（现有）扩展为 `AvatarConfig` JSON 对象。

### Agent 配置页扩展

在 `AgentConfigView` 中增加 Avatar 设置区域：
- 模型选择（下拉菜单）
- 即时预览
- 情绪映射编辑
- 人格设定（名字、特征、说话风格）

## 7. 模型管理

### 模型注册表

```typescript
interface Live2DModelEntry {
  id: string;
  name: string;
  modelUrl: string;              // 相对路径
  thumbnail: string;
  cubismVersion: 2 | 4;
  expressions: { id: string; name: string }[];
  motionGroups: { group: string; count: number }[];
  defaultEmotionMap: Record<string, number>;
}
```

存储在 `frontend/public/live2d/models.json`。

### 模型热切换

用户在聊天中可切换 Avatar 模型（不刷新页面）：

1. 卸载当前模型（`model.destroy()`）
2. 加载新模型（`Live2DModel.from()`）
3. 更新情绪映射
4. 播放招呼动作

## 8. 实现优先级

| 阶段 | 内容 | 预估 |
|------|------|------|
| **P0** | ChatView 融合 + 悬浮窗模式 | 3-4 天 |
| **P1** | Agent 工具调用 + 情绪驱动 | 2-3 天 |
| **P2** | TTS 口型同步 | 1-2 天 |
| **P3** | 并排/全屏布局模式 | 2-3 天 |
| **P4** | 用户行为感知 | 1-2 天 |
| **P5** | 记忆积累 + 人格系统 | 2-3 天 |
| **P6** | 多模型管理 + 模型热切换 | 2-3 天 |
| **P7** | Agent 配置页 Avatar 设置 | 1-2 天 |

## 9. 技术约束

- PixiJS 版本锁定 v6（pixi-live2d-display 0.4.x 不支持 v7+）
- Cubism Core SDK 必须在 index.html 预加载（import 时序要求）
- 当前仅支持 Cubism 4 模型
- 移动端 WebGL 性能需测试，必要时降低模型分辨率

## 10. 参考项目

- **Open-LLM-VTuber**: 情绪管道架构（标签注入 + 装饰器提取 + emotionMap 映射）、TTS 有序队列
- **TalkingHead**: 流式音频接口设计（start/audio/end 分阶段）
- **pixi-live2d-display**: 动作优先级系统（IDLE < NORMAL < FORCE）
