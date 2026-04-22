# Avatar 系统计划 — Live2D 角色交互

> 起始日期：2026-04-22
> 状态：基础框架已完成，待与聊天系统深度集成

## 目标

用 Live2D 角色替代纯文本交互界面，让用户通过语音与 Agent 对话，角色以表情、动作、口型同步给出视觉反馈。

## 已完成（Phase 0）

- [x] 安装 `pixi.js@^6` + `pixi-live2d-display@0.4`（Cubism 4 专用构建）
- [x] 下载 Haru Live2D Cubism 4 示例模型到 `frontend/public/live2d/`
- [x] 预加载 Cubism 4 Core SDK（`index.html` `<script>` 标签）
- [x] 创建 `Live2DAvatar.vue` 组件（PixiJS WebGL 画布、鼠标追踪、表情切换、动作触发、口型同步接口）
- [x] 创建 `AvatarView.vue` 体验页面（角色展示 + 语音录音 + 表情/动作控制面板）
- [x] 注册 `/avatar` 路由，AppHeader 添加导航入口
- [x] Vite alias 绕过 `pixi-live2d-display` exports 限制

## Phase 1：情绪驱动（SSE + 表情自动映射）

**目标**：LLM 输出时自动驱动角色表情，用户无需手动切换。

### 后端改动

1. **SSE 流新增 `emotion` 字段**
   - 在 `chat.controller.ts` 的 `handleSseStream` 中，LLM 文本 chunk 流经时提取情绪标签
   - 方案 A（轻量）：System Prompt 要求 LLM 在回复开头输出 `[emotion:joy]` 标签，后端正则提取
   - 方案 B（精准）：独立调用一个小模型/分类器对 chunk 做情绪分类
   - 推荐方案 A，零额外成本

2. **SSE 事件格式扩展**
   ```
   event: emotion
   data: {"emotion": "joy", "expression_index": 3}
   ```

### 前端改动

3. **ChatTransport 解析 `emotion` 事件**
   - `useChatTransport.ts` 中新增 `onEmotion` 回调
   - 解析后通过 provide/inject 或事件总线传递给 Live2DAvatar

4. **情绪映射配置**
   - 新建 `emotion-map.ts`：定义 emotion 关键词 → Live2D expression index 的映射
   - 映射关系可配置化（不同模型表情数量不同）

### 涉及文件

| 文件 | 改动 |
|------|------|
| `backend/src/modules/chat/chat.controller.ts` | SSE 流中提取 emotion 标签，发送 emotion 事件 |
| `backend/src/modules/agent/agent.service.ts` | System Prompt 中加入情绪标签输出指引 |
| `frontend/src/composables/useChatTransport.ts` | 解析 `emotion` SSE 事件 |
| `frontend/src/components/avatar/emotion-map.ts` | 新建：情绪映射配置 |
| `frontend/src/components/avatar/Live2DAvatar.vue` | 新增 `setEmotion(emotion)` 方法 |

## Phase 2：TTS 口型同步

**目标**：AI 语音播放时，角色嘴巴跟随音频开合。

### 实现方案

1. **复用现有 AnalyserNode**
   - `useVoice.ts` 已有 TTS 音频播放逻辑（MediaSource + SourceBuffer）
   - 在 TTS 播放时创建 AudioContext → MediaElementSource → AnalyserNode
   - 提取实时音量，映射到 Live2D `ParamMouthOpenY` 参数

2. **音量数据传递**
   - Live2DAvatar 已暴露 `volume` prop（0~1）
   - TTS 播放期间通过 reactive ref 实时更新

### 涉及文件

| 文件 | 改动 |
|------|------|
| `frontend/src/composables/useVoice.ts` | TTS 播放时创建 AnalyserNode，暴露 `ttsAudioLevel` ref |
| `frontend/src/views/AvatarView.vue` | 将 `ttsAudioLevel` 绑定到 Live2DAvatar `volume` prop |

## Phase 3：模型管理与多角色

**目标**：用户可切换不同 Live2D 角色，支持自定义模型上传。

### 实现

1. **模型配置文件**
   ```json
   // frontend/public/live2d/models.json
   [
     { "id": "haru", "name": "Haru", "modelUrl": "/live2d/haru/haru_greeter_t03.model3.json" },
     { "id": "shizuku", "name": "Shizuku", "modelUrl": "/live2d/shizuku/shizuku.model.json" }
   ]
   ```

2. **模型选择器组件**
   - AvatarView 页面顶部添加模型选择下拉
   - 切换模型时销毁旧 PixiJS Application，重新加载

3. **表情映射按模型配置**
   - `emotion-map.ts` 按 model id 加载不同映射关系

### 涉及文件

| 文件 | 改动 |
|------|------|
| `frontend/public/live2d/models.json` | 新建：模型列表配置 |
| `frontend/src/components/avatar/Live2DAvatar.vue` | 支持 `modelUrl` 动态切换，销毁重建 |
| `frontend/src/views/AvatarView.vue` | 添加模型选择器 |
| `frontend/src/components/avatar/emotion-map.ts` | 按模型 ID 加载映射 |

## Phase 4：与聊天页集成

**目标**：Live2D 角色嵌入 ChatView，替代纯文本交互模式。

### 两种集成模式

| 模式 | 说明 |
|------|------|
| **悬浮窗** | 角色以小窗悬浮在聊天页右下角，语音对话时角色反馈表情/口型 |
| **全屏替代** | 隐藏文字聊天区域，只显示角色 + 语音输入按钮（类似 Open-LLM-VTuber） |

### 涉及文件

| 文件 | 改动 |
|------|------|
| `frontend/src/views/ChatView.vue` | 集成 Live2DAvatar 悬浮窗模式 |
| `frontend/src/stores/chat.ts` | 添加 avatar 模式开关状态 |
| `frontend/src/components/chat/ChatContainer.vue` | 根据模式切换布局 |

## Phase 5：进阶交互（探索性）

- **视觉感知**：Agent 通过摄像头观察用户表情/手势，调整回复风格
- **3D 形象**：迁移到 TalkingHead + Ready Player Me，支持 3D 全身形象
- **物理硬件**：参考 ClawStage，探索 Agent 角色跨设备迁移（手机→桌面→实体）
- **多角色对话**：不同 Agent 绑定不同 Live2D 角色，Supervisor 切换时角色也切换

## 技术约束

| 约束 | 说明 |
|------|------|
| PixiJS 版本 | 必须使用 v6（`pixi-live2d-display` 0.4.x 不支持 v7+） |
| Core SDK 加载 | 必须在 `index.html` 预加载（import 时序要求） |
| Cubism 版本 | 仅支持 Cubism 4（Cubism 2 需额外 `live2d.min.js`） |
| 模型格式 | `.model3.json`（Cubism 4）或 `.model.json`（Cubism 2，需额外配置） |
| 性能 | PixiJS WebGL 画布持续渲染，移动端需注意 GPU 占用 |

## 参考

- [pixi-live2d-display 文档](https://guansss.github.io/pixi-live2d-display/)
- [Open-LLM-VTuber 架构](https://github.com/Open-LLM-VTuber/Open-LLM-VTuber)
- [Live2D 官方示例模型](https://www.live2d.com/en/learn/sample/)
- [TalkingHead 3D 头像](https://github.com/met4citizen/TalkingHead)
