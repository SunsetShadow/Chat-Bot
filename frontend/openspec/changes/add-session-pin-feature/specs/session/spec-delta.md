# Spec Delta: 会话删除与置顶功能

## ADDED Requirements

### Requirement: 会话置顶
用户 SHALL 能够将会话置顶，置顶会话显示在列表顶部。

#### Scenario: 置顶会话
GIVEN 用户有一个未置顶的会话
WHEN 用户点击置顶按钮
THEN 会话 is_pinned 设置为 true
AND 会话移动到列表顶部
AND 显示置顶图标

#### Scenario: 取消置顶
GIVEN 用户有一个已置顶的会话
WHEN 用户点击取消置顶按钮
THEN 会话 is_pinned 设置为 false
AND 会话恢复按时间排序
AND 置顶图标消失

#### Scenario: 置顶会话排序
GIVEN 有多个会话，部分已置顶
WHEN 用户查看会话列表
THEN 置顶会话显示在顶部
AND 置顶会话之间按更新时间排序
AND 非置顶会话在置顶会话之后按更新时间排序

---

### Requirement: 删除确认
用户删除会话前 SHALL 看到确认对话框，防止误删。

#### Scenario: 删除确认
GIVEN 用户点击删除按钮
WHEN 删除操作触发
THEN 显示确认对话框
AND 对话框包含会话标题
AND 用户可选择确认或取消

#### Scenario: 确认删除
GIVEN 删除确认对话框显示
WHEN 用户点击确认
THEN 会话被删除
AND 列表更新
AND 如果是当前会话，清空消息区

#### Scenario: 取消删除
GIVEN 删除确认对话框显示
WHEN 用户点击取消
THEN 对话框关闭
AND 会话保持不变

---

## MODIFIED Requirements

### Requirement: Session 数据模型
Session 模型 SHALL 包含置顶状态字段。

#### Scenario: 新会话默认不置顶
GIVEN 用户创建新会话
WHEN 会话保存
THEN is_pinned 默认为 false

---

## API Specification

### PUT /api/v1/sessions/{session_id}/pin

**请求体:**
```json
{
  "is_pinned": true
}
```

**响应:**
```json
{
  "data": {
    "id": "session_xxx",
    "title": "会话标题",
    "is_pinned": true
  }
}
```

### GET /api/v1/sessions

**响应排序规则:**
1. is_pinned = true 的会话优先
2. 同组内按 updated_at 倒序

---

## UI Specification

### 会话项布局

```
┌──────────────────────────────────┐
│ 📌 会话标题                       │  ← 已置顶显示图标
│    5 条消息 · 2分钟前    [📌][🗑️] │  ← 悬停显示操作按钮
└──────────────────────────────────┘
```

### 删除确认对话框

```
┌────────────────────────────────────┐
│  ⚠️ 确认删除                        │
│                                    │
│  确定要删除会话 "会话标题" 吗？      │
│  此操作无法撤销。                   │
│                                    │
│        [取消]      [确认删除]       │
└────────────────────────────────────┘
```
