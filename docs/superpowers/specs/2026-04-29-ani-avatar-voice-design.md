# Ani Avatar + Voice 联动设计

## 概述

Ani Agent 的人格由三部分组成：LLM 大脑、Avatar 身体、TTS 声音。本设计将当前散落的前端行为逻辑收拢为统一的行为控制层，实现说话时的自然行为、情绪自动联动、口型同步升级，并支持 TTS 引擎和 Live2D 模型的可替换。

**核心约束**：Avatar 是 Ani 的身体，不是通用组件。Ani 说话 = avatar 说话。

## 架构定位

```
                    ┌─────────────────────┐
                    │       Ani Agent      │
                    │  (人格 + 身体 + 声音)  │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
        ┌──────────┐   ┌───────────┐   ┌──────────┐
        │ LLM 大脑  │   │ Avatar    │   │ TTS 声音  │
        │ (文本输出) │   │ (视觉表现) │   │ (语音输出) │
        └──────────┘   └───────────┘   └──────────┘
              │                │▲               │
              │    行为指令     ││  口型数据      │
              └────────────────┘└────────────────┘
```

设计原则：

1. **单一归属**：Avatar 只服务 Ani，不存在"谁在说话"的判断问题
2. **行为统一**：一个 `useAniBehavior` composable 管理所有视觉行为
3. **TTS 可替换**：抽象 `TtsProvider` 接口，腾讯云默认实现，可扩展 Azure 等
4. **模型可替换**：抽象 `AvatarModelConfig` 接口，Haru 默认实现

优先级合并：LLM 工具指令覆盖自动行为，指令结束后回退。

## 行为状态机

4 个状态驱动 Ani 的所有视觉行为：

```
              ┌──────────┐    SSE 文本流开始    ┌──────────┐
              │   idle   │──────────────────▶│ speaking │
              │  (待机)   │◀──────────────────│  (说话)   │
              └──────────┘    TTS 播放结束     └──────────┘
                │     ▲                          │     ▲
                │     │     avatar_action SSE     │     │
                ▼     │                          ▼     │
              ┌──────────┐                    ┌──────────┐
              │ reacting │                    │listening │
              │ (情绪反应) │                    │ (倾听中)  │
              └──────────┘                    └──────────┘
```

### 状态定义

| 状态 | 触发条件 | 行为 |
|------|---------|------|
| `idle` | 初始状态 / speaking 结束后 3s 无活动 | 呼吸、随机眨眼、偶尔小动作、中性表情 |
| `speaking` | TTS 开始播放 | 口型同步 + 说话手势 + 随情绪变化的表情基线 |
| `reacting` | 收到 `avatar_action` SSE（LLM 工具指令） | 执行表情/动作，完成后回到前一状态 |
| `listening` | 用户开始语音输入（ASR 录音中） | 专注表情、点头微动 |

### 自动化行为

**idle**：
- 呼吸周期：`ParamBreath` 正弦波，3-4s 周期
- 眨眼：随机间隔 2-5s，`ParamEyeLOpen/ROpen` 0→1 快速过渡
- 微动作：每 10-20s 随机播放 Idle 组动作
- 表情：neutral 基线

**speaking**：
- 口型：`ParamMouthOpenY`（来自音量或 viseme）
- 眨眼：降低频率 3-7s
- 头部微动：轻微 `ParamAngleX/Y` 随机偏移
- 手势：根据情绪基线选择动作组
- 表情基线：由情绪联动决定

**listening**：
- 表情：attentive/thinking
- 头部：轻微倾斜
- 眨眼：正常频率

**reacting**：
- 立即执行 LLM 指定的表情/动作
- 优先级最高，覆盖所有自动化行为
- 当前行为暂停（口型/呼吸/眨眼保持最后值）
- 动作完成后恢复前一状态

## 情绪联动

两层联动机制：

### 第一层：LLM 主动控制（高优先级）

现有机制保留。Ani 通过 `express_emotion` / `play_motion` 工具主动表达，触发 `reacting` 状态。

### 第二层：前端自动情绪（低优先级 fallback）

LLM 未调用工具时，前端从 SSE 文本流提取情绪信号。

**信号来源**：逐 chunk 累积，每 N 个 token 或句末标点时分析。

**检测策略**：情绪关键词词典 + 标点模式匹配。

```typescript
const emotionRules = [
  { keywords: ['哈哈', '开心', '太好了', '！'], emotion: 'happy', weight: 1 },
  { keywords: ['抱歉', '不好意思', '遗憾'], emotion: 'sad', weight: 1 },
  { keywords: ['嗯', '让我想想', '这个问题'], emotion: 'thinking', weight: 1 },
  { keywords: ['！{2,}', '太棒', '哇'], emotion: 'excited', weight: 2 },
  { keywords: ['？', '吗？', '呢？'], emotion: 'neutral', weight: 0 },
]
```

### 情绪基线

每个状态有一个情绪基线，影响该状态内的自动化行为：

| 情绪基线 | speaking 行为 | idle 行为 |
|---------|-------------|----------|
| `neutral` | 正常手势频率 | 标准待机 |
| `happy` | 更活跃手势、偶尔点头 | 嘴角微上扬 |
| `sad` | 动作减少、低头 | 缓慢呼吸 |
| `thinking` | 手托腮动作、减少眨眼 | 眼神游离 |
| `excited` | 动作频繁、头部微动大 | 活力充沛 |

### 情绪衰减

- LLM 设置的情绪：持续到下一个 LLM 情绪指令，或 30s 自然衰减到 neutral
- 前端检测的情绪：持续到下一句文本分析，每句重新评估

## 口型同步

### Phase 1（短期）：优化音量驱动

当前问题：太平、没有节奏感、小音量也张嘴。

优化措施：
- 噪声门限：volume < 0.05 → 0
- 指数移动平均 smoothing，消除跳变
- 开口/闭口速度差异：张嘴快 80ms、闭嘴慢 150ms
- 随机微抖，避免机械感

### Phase 2（中期）：TTS Provider 抽象

```typescript
interface TtsProvider {
  synthesizeStream(text: string): AsyncIterable<TtsAudioChunk>
  onViseme?: (event: VisemeEvent) => void
}

interface VisemeEvent {
  visemeId: number
  startTime: number  // ms
  duration: number   // ms
}

interface TtsAudioChunk {
  audio: Buffer
  isFinal: boolean
  metadata?: {
    visemes?: VisemeEvent[]
  }
}
```

- 腾讯云 TtsProvider：不实现 `onViseme`，走 Phase 1 音量驱动
- Azure TtsProvider（未来）：实现 `onViseme`，前端按时间线驱动口型

### Viseme 映射

映射表放在 `AvatarModelConfig` 中，不同模型参数名可能不同：

```
viseme ID → { mouthOpenY, mouthForm }
  0 (silent) → { 0.0, 0.0 }
  1 (aa)     → { 1.0, 0.0 }
  2 (ae)     → { 0.8, 0.3 }
  3 (oh)     → { 0.7, -0.5 }
  4 (uu)     → { 0.4, -0.8 }
```

### WebSocket 协议扩展

新增 JSON 消息类型用于 viseme 事件传递：

```json
{
  "type": "viseme",
  "data": {
    "visemes": [
      { "id": 1, "offset": 0, "duration": 120 },
      { "id": 4, "offset": 120, "duration": 80 }
    ],
    "audioOffset": 0
  }
}
```

前端根据 WebSocket 协商自动选择音量/viseme 模式。

## 多模型支持

### AvatarModelConfig 接口

```typescript
interface AvatarModelConfig {
  id: string
  name: string
  modelUrl: string

  params: {
    mouthOpenY: string
    mouthForm: string
    eyeLOpen: string
    eyeROpen: string
    angleX: string
    angleY: string
    breath: string
    bodyAngleX: string
  }

  expressions: Record<EmotionType, number>
  motions: {
    idle: MotionGroupConfig
    tap: MotionGroupConfig
    speak?: MotionGroupConfig
    greeting?: MotionGroupConfig
  }
  visemeMap?: Record<number, Partial<Record<keyof params, number>>>
}

type EmotionType = 'neutral' | 'happy' | 'sad' | 'angry' | 'surprised' | 'thinking' | 'excited' | 'sympathetic'
```

每个模型一个配置文件，运行时动态加载。

## 前端模块架构

```
components/avatar/
├── AvatarFloat.vue              # (现有) 悬浮窗容器
├── Live2DAvatar.vue             # (现有) 渲染层，接收参数驱动
├── AniAvatar.vue                # (新增) Ani 专属入口

composables/avatar/
├── useAniBehavior.ts            # 行为状态机 + 自动化行为调度
├── useEmotionDetector.ts        # SSE 文本流情绪检测
├── useLipSync.ts                # 口型同步（音量/viseme 双模式）
├── useAvatarModel.ts            # 模型加载 + 参数映射

config/avatar/
├── models/
│   ├── haru.ts                  # Haru 模型配置
│   └── index.ts                 # 模型注册表
├── emotion-keywords.ts          # 情绪关键词词典
```

### 调用关系

```
AniAvatar.vue
  ├── useAvatarModel(config) → setParam(), setExpression(), playMotion()
  ├── useAniBehavior() → 状态机 + 自动行为 + 情绪基线
  ├── useLipSync() → Phase1: 音量分析 / Phase2: viseme 时间线
  └── useEmotionDetector() → SSE chunk → 情绪标签 → emotionBaseline

useAniBehavior 统一调度 → useAvatarModel.setParam()
Live2DAvatar 只负责渲染
```

### 现有文件改动

| 文件 | 改动 |
|------|------|
| `AvatarFloat.vue` | 接入 `AniAvatar`，移除散落的行为逻辑 |
| `Live2DAvatar.vue` | 移除 `watch(volume)`，参数由外部统一驱动 |
| `useVoice.ts` | 提取口型同步逻辑到 `useLipSync` |
| `useAIChat.ts` | `avatarAction` ref 保留，由 `useAniBehavior` 消费 |
| `emotion-map.ts` | 合并到 `AvatarModelConfig.expressions` |

## 实施顺序

1. **行为状态机**：`useAniBehavior` + `useAvatarModel` + 4 状态 + 自动化行为（呼吸/眨眼/微动作）
2. **情绪联动**：`useEmotionDetector` + 情绪基线 + 两层合并
3. **口型优化 Phase 1**：`useLipSync` 音量模式优化
4. **TTS 抽象层**：后端 `TtsProvider` 接口 + 前端双模式切换
5. **口型优化 Phase 2**：viseme 驱动（依赖 TTS 引擎切换）
6. **多模型**：`AvatarModelConfig` 完整实现 + 模型管理 UI
