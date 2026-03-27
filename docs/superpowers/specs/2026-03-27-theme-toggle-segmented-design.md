# 主题切换分段控制器设计

## 背景

当前主题切换使用下拉菜单（NDropdown），需要点击展开才能看到选项。用户希望主题选项直接展示在顶部，减少一次点击操作。

## 设计决策

### 布局方案
**分段控制器（Segmented Control）** - 类似 iOS 风格的紧凑按钮组

### 图标样式
**图标 + 文字** - 提供更好的可读性和新用户体验

## UI 设计

```
┌─────────────────────────────────────────────────────────┐
│  Chat Bot          Agent名称      [☀️ 亮色|🌙 暗色|💻 系统] ⚙️  │
└─────────────────────────────────────────────────────────┘
```

- 使用 Naive UI 的 `NButtonGroup` 组件
- 三个按钮：亮色（SunnyOutline）、暗色（MoonOutline）、系统（DesktopOutline）
- 当前选中项使用 `type="primary"` 高亮
- 保持赛博朋克/霓虹风格

## 技术方案

### 文件变更

| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `ThemeToggle.vue` | 修改 | 下拉菜单改为分段控制器 |
| `ThemeToggle.test.ts` | 修改 | 更新测试用例适配新 UI |

### 实现细节

1. **移除组件**: `NDropdown`
2. **新增组件**: `NButtonGroup`, `NButton`
3. **保持不变**: `theme.ts` store 逻辑
4. **样式**: 保持现有的霓虹风格配色

### 按钮配置

```typescript
const options = [
  { label: '亮色', value: 'light', icon: SunnyOutline },
  { label: '暗色', value: 'dark', icon: MoonOutline },
  { label: '系统', value: 'system', icon: DesktopOutline },
]
```

## 验收标准

- [ ] 三个主题按钮直接显示在顶部
- [ ] 点击按钮立即切换主题
- [ ] 当前选中项高亮显示
- [ ] 亮色/暗色模式下视觉正常
- [ ] 单元测试通过
