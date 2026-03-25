# Proposal: 会话删除与置顶功能

## Why

当前会话列表：
1. 删除操作无确认，易误删
2. 缺少置顶功能，重要会话难以快速访问
3. 置顶会话需要显示在列表顶部

## What Changes

### 删除优化
1. **前端** - 添加删除确认对话框
2. **前端** - 优化删除按钮交互（悬停显示）

### 置顶功能
1. **后端** - Session 模型增加 `is_pinned` 字段
2. **后端** - 新增 PUT `/sessions/{id}/pin` 端点
3. **后端** - 列表排序：置顶会话优先
4. **前端** - 会话项添加置顶按钮
5. **前端** - 置顶会话显示置顶图标
6. **前端** - 置顶会话排序到顶部

## Impact

### 后端变更
- `backend/app/schemas/chat.py` - Session 添加 is_pinned 字段
- `backend/app/api/v1/chat.py` - 新增置顶端点
- `backend/app/services/chat_service.py` - 置顶逻辑 + 排序

### 前端变更
- `frontend/src/types/index.ts` - SessionResponse 添加 is_pinned
- `frontend/src/api/chat.ts` - 添加 pinSession API
- `frontend/src/stores/chat.ts` - 添加 pinSession 方法
- `frontend/src/components/chat/SessionList.vue` - 置顶 UI + 删除确认

### API 变更
- 新增 `PUT /api/v1/sessions/{id}/pin` - 置顶/取消置顶
