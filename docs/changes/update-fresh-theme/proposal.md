# 提案：更新前端 UI 主题为清新风格

## Change ID

`update-fresh-theme`

## Why

当前 Chat Bot 前端采用赛博朋克/霓虹未来主义主题，具有以下特点：
- 深色背景 (#0a0a0f)
- 高饱和度霓虹色 (青色、紫色、粉色)
- 发光效果和扫描线动画
- 玻璃拟态效果

**问题**：
1. 深色主题在某些场景下可能过于沉重
2. 霓虹发光效果可能造成视觉疲劳
3. 赛博朋克风格与部分用户偏好不符
4. 长时间使用深色界面可能不适合所有用户

**机会**：
- 清新风格更符合现代 UI 设计趋势
- 浅色主题适合日常长时间使用
- 柔和配色减少视觉压力

## What Changes

将前端主题从「赛博朋克/霓虹未来主义」更新为「清新现代」风格。

### 配色方案变更

| 元素 | 当前 (赛博朋克) | 新方案 (清新) |
|------|----------------|---------------|
| 主背景 | #0a0a0f (深黑) | #f8fafc (淡灰白) |
| 次背景 | #12121a (深灰) | #ffffff (纯白) |
| 卡片背景 | rgba(18,18,26,0.7) | #ffffff |
| 主强调色 | #00f5d4 (霓虹青) | #3b82f6 (天蓝) |
| 次强调色 | #9b5de5 (霓虹紫) | #10b981 (翠绿) |
| 主文字 | #e8e8ed | #1e293b |
| 次文字 | #9898a8 | #64748b |
| 边框 | rgba(255,255,255,0.06) | #e2e8f0 |

### 样式效果变更

| 效果 | 当前 | 新方案 |
|------|------|--------|
| 发光效果 | 霓虹发光 | 无发光，柔和阴影 |
| 玻璃拟态 | backdrop-filter: blur(20px) | 简洁白底 + 轻阴影 |
| 渐变边框 | 动态渐变 | 静态细边框 |
| 扫描线 | 有 | 移除 |
| 背景噪点 | 有 | 移除 |

### 字体保留

- 显示字体：Sora (保持不变)
- 代码字体：JetBrains Mono (保持不变)

## Impact

### 受影响的文件

**核心样式**：
- `frontend/src/assets/main.css` - 全局 CSS 变量和基础样式
- `frontend/src/App.vue` - Naive UI 主题配置

**组件样式**：
- `frontend/src/components/chat/MessageItem.vue` - 消息气泡样式
- `frontend/src/components/chat/ChatContainer.vue` - 聊天容器
- `frontend/src/components/chat/SessionList.vue` - 会话列表
- `frontend/src/components/chat/MessageInput.vue` - 输入框
- `frontend/src/components/common/AppHeader.vue` - 顶部导航
- `frontend/src/components/agent/AgentSelector.vue` - Agent 选择器
- `frontend/src/components/agent/AgentEditor.vue` - Agent 编辑器
- `frontend/src/components/rules/RuleItem.vue` - 规则项
- `frontend/src/components/rules/RuleEditor.vue` - 规则编辑器

### 规范更新

- `openspec/specs/development-guide/spec.md` - UI 主题章节

### 用户体验影响

- 正面：更清爽的视觉体验，减少视觉疲劳
- 注意：现有用户可能需要适应期

### API 影响

无 API 变更。

### 兼容性

- 浏览器兼容性保持不变
- 无需数据库迁移
