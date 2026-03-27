# Dark Mode 设计文档

## 概述

为 Chat Bot 前端实现黑暗模式功能，支持三种模式：亮色、暗色、跟随系统。暗色模式采用赛博朋克/霓虹未来主义风格，与项目主题一致。

## 技术方案

### 架构

```
stores/theme.ts          # 主题状态管理 (Pinia)
main.css                 # CSS 变量定义
App.vue                  # Naive UI 主题动态切换
components/common/ThemeToggle.vue  # 切换组件
```

### 状态管理

```typescript
// stores/theme.ts
type ThemeMode = 'light' | 'dark' | 'system'

interface ThemeState {
  mode: ThemeMode                    // 用户选择
  resolvedMode: 'light' | 'dark'     // 实际生效
}
```

**行为**：
- `mode: 'system'` 时，监听 `prefers-color-scheme` 媒体查询
- 状态持久化到 `localStorage`（key: `theme-mode`）
- 初始化时读取 localStorage，无值则默认 `system`

### CSS 变量

在 `main.css` 中添加 `:root.dark` 选择器：

```css
:root {
  /* 现有亮色变量 */
}

:root.dark {
  --bg-primary: #0f0a1a;
  --bg-secondary: #1a1025;
  --color-primary: #00f0ff;
  /* ... */
}
```

### Naive UI 主题

在 `App.vue` 中：
- 引入 `darkTheme` from naive-ui
- 创建 `darkThemeOverrides` 对象（赛博朋克配色）
- 根据 `resolvedMode` 动态切换 `:theme` 和 `:theme-overrides`

### 切换 UI

**位置 1 - 顶部导航栏** (`AppHeader.vue`)：
- 添加主题切换按钮（图标 + 下拉菜单）
- 选项：亮色 / 暗色 / 跟随系统

**位置 2 - 设置页面** (`SettingsView.vue`)：
- 添加主题设置区块
- 使用 n-radio-group 展示三个选项

## 配色方案

### 亮色主题（现有）

| 变量 | 值 |
|------|---|
| --bg-primary | #f8fafc |
| --bg-secondary | #ffffff |
| --color-primary | #3b82f6 |
| --text-primary | #1e293b |

### 暗色赛博朋克主题

| 变量 | 值 | 说明 |
|------|---|------|
| --bg-primary | #0f0a1a | 深紫灰 |
| --bg-secondary | #1a1025 | 稍浅紫灰 |
| --bg-tertiary | #251a35 | 第三层 |
| --color-primary | #00f0ff | 霓虹青 |
| --color-primary-hover | #33f3ff | 霓虹青亮 |
| --color-secondary | #bf5af2 | 霓虹紫 |
| --color-accent | #ff2d92 | 霓虹粉 |
| --text-primary | #e2e8f0 | 亮灰 |
| --text-secondary | #94a3b8 | 次级灰 |
| --border-color | rgba(191, 90, 242, 0.2) | 半透明紫 |

## 实现任务

1. **创建 theme store** - `stores/theme.ts`
2. **扩展 CSS 变量** - 在 `main.css` 添加 `:root.dark`
3. **修改 App.vue** - 动态切换 Naive UI 主题
4. **创建 ThemeToggle 组件** - 可复用的切换组件
5. **集成到 AppHeader** - 顶部导航栏
6. **集成到 SettingsView** - 设置页面

## 边界情况

- 首次访问无 localStorage：默认 `system` 模式
- 系统主题变化时自动切换（仅 `system` 模式）
- SSR 无关（纯客户端应用）
