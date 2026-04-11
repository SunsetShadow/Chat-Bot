# Proposal: Migrate to Tailwind CSS

**Change ID**: `migrate-to-tailwind-css`
**Status**: Draft
**Created**: 2025-03-25

---

## Why

当前项目已安装 Tailwind CSS v4.2.2，但组件仍在使用自定义 CSS 类（main.css 有 286 行）。这导致：

1. **维护成本高**：修改样式需要在 CSS 文件和组件间来回切换
2. **不一致**：混用自定义类和 Tailwind 类会导致样式不一致
3. **违反规范**：开发规范明确要求"不要写自定义 CSS"

## What Changes

将 main.css 中的自定义 CSS 类迁移到 Tailwind 工具类：

1. 删除 main.css 中的组件样式（保留 CSS 变量和主题配置）
2. 更新所有 Vue 组件，使用 Tailwind 类替代自定义类
3. 保留必要的全局样式（字体导入、CSS 变量）

## Impact

### 受影响的文件

| 类型 | 文件 | 影响 |
|------|------|------|
| CSS | `frontend/src/assets/main.css` | 删除组件样式，保留变量 |
| 组件 | `frontend/src/components/**/*.vue` | 类名迁移 |
| 视图 | `frontend/src/views/**/*.vue` | 类名迁移 |

### 受影响的规范

- `openspec/specs/development/spec.md` - 已有 Tailwind 约束

### 风险

- **低风险**：纯样式迁移，不改变功能逻辑
- **回归测试**：需要视觉回归测试确保样式一致

## Scope

**包含**：
- 组件级样式迁移
- 布局样式迁移
- 保留 CSS 变量和主题配置

**不包含**：
- 设计变更
- 组件重构
- 新功能开发
