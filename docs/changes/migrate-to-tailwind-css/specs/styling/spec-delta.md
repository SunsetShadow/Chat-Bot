# Spec Delta: Migrate to Tailwind CSS

**Change ID**: `migrate-to-tailwind-css`
**Target Spec**: `openspec/specs/development/spec.md`

---

## MODIFIED Requirements

### Requirement: 样式开发规范
WHEN 开发者编写组件样式,
系统 SHALL 使用 Tailwind CSS 工具类而非自定义 CSS。

#### Scenario: 使用 Tailwind 工具类
GIVEN 开发者需要为元素添加样式
WHEN 开发者编写模板
THEN 开发者 SHALL 使用 Tailwind 工具类（如 `bg-primary`, `text-secondary`）
AND 不 SHALL 创建自定义 CSS 类

#### Scenario: 使用 CSS 变量
GIVEN 需要使用主题颜色或设计 token
WHEN 开发者引用颜色或尺寸
THEN 开发者 SHALL 使用 CSS 变量（如 `var(--color-primary)`）
OR 使用 Tailwind 配置的自定义颜色

#### Scenario: 保留全局样式
GIVEN 需要定义全局样式
WHEN 样式适用于整个应用
THEN main.css SHALL 只包含：
- CSS 变量定义（:root）
- 字体导入（@import url）
- Tailwind 导入（@import "tailwindcss"）
- 必要的全局样式（滚动条、选中态等）

### Requirement: 组件样式迁移
WHEN 将现有自定义 CSS 迁移到 Tailwind,
开发者 SHALL 遵循以下映射规则。

#### Scenario: 布局类迁移
GIVEN 自定义布局类（如 `.chat-container`, `.sidebar`）
WHEN 迁移到 Tailwind
THEN 使用 Tailwind 布局类（如 `flex`, `grid`, `w-*`, `h-*`）

#### Scenario: 颜色类迁移
GIVEN 自定义颜色类（如 `.accent-text`, `.btn-primary`）
WHEN 迁移到 Tailwind
THEN 使用 Tailwind 颜色类或 CSS 变量（如 `text-[var(--color-primary)]`）

#### Scenario: 交互类迁移
GIVEN 自定义交互类（如 `.btn-*`, `:hover`）
WHEN 迁移到 Tailwind
THEN 使用 Tailwind 交互修饰符（如 `hover:`, `active:`, `focus:`）

---

## REMOVED Requirements

### Requirement: 自定义组件 CSS 类
~~WHEN 开发者需要为组件添加样式,~~
~~可以创建自定义 CSS 类。~~

**移除原因**: 规范已更新，禁止自定义 CSS 类，统一使用 Tailwind。
