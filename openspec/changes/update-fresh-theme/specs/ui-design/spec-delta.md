# UI 设计规范差异

## MODIFIED Requirements

### Requirement: 主题配色
WHEN 用户访问 Chat Bot 应用,
系统 SHALL 使用清新现代的浅色主题。

#### Scenario: 默认主题展示
GIVEN 用户首次访问应用
WHEN 应用加载完成
THEN 背景色为 #f8fafc (淡灰白)
AND 卡片背景为 #ffffff (纯白)
AND 主强调色为 #3b82f6 (天蓝)
AND 次强调色为 #10b981 (翠绿)

#### Scenario: 文字颜色层次
GIVEN 应用使用浅色主题
WHEN 显示文字内容
THEN 主文字颜色为 #1e293b (深灰)
AND 次要文字颜色为 #64748b (中灰)
AND 禁用文字颜色为 #94a3b8 (浅灰)

---

### Requirement: 卡片样式
WHEN 显示卡片组件,
系统 SHALL 使用简洁的白底卡片配合轻柔阴影。

#### Scenario: 卡片基础样式
GIVEN 卡片组件渲染
WHEN 用户查看卡片
THEN 卡片背景为 #ffffff
AND 卡片边框为 #e2e8f0
AND 卡片圆角为 16px
AND 卡片阴影为 0 1px 3px rgba(0,0,0,0.1)

#### Scenario: 卡片悬停效果
GIVEN 用户悬停在卡片上
WHEN 鼠标移入卡片
THEN 边框颜色变为 #3b82f6 (主强调色)
AND 阴影变为 0 4px 12px rgba(59,130,246,0.15)
AND 不使用发光效果

---

### Requirement: 消息气泡样式
WHEN 显示聊天消息,
系统 SHALL 使用柔和配色的气泡样式。

#### Scenario: 用户消息气泡
GIVEN 用户发送消息
WHEN 消息显示在聊天界面
THEN 背景为 linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)
AND 文字颜色为 #ffffff
AND 圆角为 16px 16px 4px 16px
AND 无发光效果

#### Scenario: AI 消息气泡
GIVEN AI 回复消息
WHEN 消息显示在聊天界面
THEN 背景为 #ffffff
AND 边框为 1px solid #e2e8f0
AND 文字颜色为 #1e293b
AND 圆角为 16px 16px 16px 4px

#### Scenario: 消息头像
GIVEN 显示消息头像
WHEN 渲染头像图标
THEN 用户头像背景为主强调色 #3b82f6
AND AI 头像背景为 #f1f5f9
AND AI 头像图标颜色为 #64748b
AND 无发光效果

---

### Requirement: 输入框样式
WHEN 用户使用输入框,
系统 SHALL 使用清晰的边框和柔和的聚焦效果。

#### Scenario: 输入框默认状态
GIVEN 输入框组件
WHEN 输入框未聚焦
THEN 背景为 #ffffff
AND 边框为 1px solid #e2e8f0
AND 占位符颜色为 #94a3b8

#### Scenario: 输入框聚焦状态
GIVEN 输入框获得焦点
WHEN 用户点击输入框
THEN 边框变为 2px solid #3b82f6
AND 外发光为 0 0 0 3px rgba(59,130,246,0.1)
AND 无霓虹发光效果

---

### Requirement: 按钮样式
WHEN 显示按钮组件,
系统 SHALL 使用现代扁平设计。

#### Scenario: 主按钮
GIVEN 主操作按钮
WHEN 按钮渲染
THEN 背景为主强调色 #3b82f6
AND 文字为白色
AND 圆角为 8px
AND 悬停时背景加深为 #2563eb

#### Scenario: 次要按钮
GIVEN 次要操作按钮
WHEN 按钮渲染
THEN 背景透明
AND 边框为 1px solid #e2e8f0
AND 文字颜色为 #64748b
AND 悬停时背景变为 #f1f5f9

---

### Requirement: 背景效果
WHEN 渲染应用背景,
系统 SHALL 使用简洁的纯色或微渐变背景。

#### Scenario: 应用背景
GIVEN 应用主背景
WHEN 页面加载
THEN 背景为 #f8fafc 纯色或柔和渐变
AND 移除背景噪点图案
AND 移除扫描线动画
AND 移除霓虹光晕效果

---

### Requirement: 加载动画
WHEN 显示加载状态,
系统 SHALL 使用柔和的脉冲动画。

#### Scenario: 消息加载状态
GIVEN AI 正在生成回复
WHEN 显示加载指示器
THEN 使用三个圆点动画
AND 圆点颜色为 #3b82f6 (主强调色)
AND 动画为柔和的淡入淡出
AND 无发光效果

---

## REMOVED Requirements

### Requirement: 霓虹发光效果
~~WHEN 显示强调元素,~~
~~系统 SHALL 使用霓虹发光效果。~~

**移除原因**：清新主题不使用发光效果。

---

### Requirement: 扫描线动画
~~WHEN 渲染特定容器,~~
~~系统 SHALL 显示扫描线动画效果。~~

**移除原因**：赛博朋克风格特有，与清新主题不符。

---

### Requirement: 玻璃拟态效果
~~WHEN 显示卡片和模态框,~~
~~系统 SHALL 使用 backdrop-filter: blur 效果。~~

**移除原因**：浅色主题使用纯白底更清晰简洁。

---

### Requirement: 背景噪点图案
~~WHEN 渲染应用背景,~~
~~系统 SHALL 叠加 SVG 噪点纹理。~~

**移除原因**：清新主题保持背景干净。

---

## 配色参考

### 新配色方案

| 名称 | 变量名 | 色值 | 用途 |
|------|--------|------|------|
| 主背景 | --bg-primary | #f8fafc | 页面背景 |
| 次背景 | --bg-secondary | #ffffff | 卡片、模态框 |
| 三级背景 | --bg-tertiary | #f1f5f9 | 输入框、悬停状态 |
| 主强调色 | --color-primary | #3b82f6 | 按钮、链接、焦点 |
| 主强调悬停 | --color-primary-hover | #2563eb | 悬停状态 |
| 主强调按下 | --color-primary-pressed | #1d4ed8 | 按下状态 |
| 次强调色 | --color-secondary | #10b981 | 成功状态、辅助 |
| 警告色 | --color-warning | #f59e0b | 警告提示 |
| 错误色 | --color-error | #ef4444 | 错误提示 |
| 主文字 | --text-primary | #1e293b | 主要内容 |
| 次文字 | --text-secondary | #64748b | 次要内容 |
| 弱文字 | --text-muted | #94a3b8 | 占位符、禁用 |
| 边框色 | --border-color | #e2e8f0 | 边框、分割线 |
| 边框悬停 | --border-hover | #cbd5e1 | 悬停边框 |

### 阴影规范

```css
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1);
--shadow-md: 0 4px 6px rgba(0, 0, 0, 0.07);
--shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.1);
--shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.1);
--shadow-primary: 0 4px 12px rgba(59, 130, 246, 0.15);
```

### 圆角规范

```css
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 16px;
--radius-xl: 24px;
--radius-full: 9999px;
```
