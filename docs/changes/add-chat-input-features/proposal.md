# Proposal: Chat Input Features

**Change ID**: `add-chat-input-features`
**Status**: Draft
**Created**: 2025-03-25

---

## Why

当前聊天输入框功能单一，仅支持纯文本输入。用户需要更强大的输入能力：

1. **附件上传**：用户希望发送图片、文档等附件，以便 AI 能够分析文件内容
2. **联网搜索**：用户希望 AI 能够实时获取互联网信息，回答时效性问题
3. **思考过程**：用户希望看到 AI 的推理过程，增强透明度和信任度

## What Changes

### 1. 附件上传功能

- 在输入框左侧添加附件上传按钮（📎）
- 支持的文件类型：
  - 图片：PNG, JPG, JPEG, GIF, WebP
  - 文档：PDF, TXT, MD, DOC, DOCX
- 上传后显示附件预览（图片缩略图/文件图标）
- 单次最多上传 5 个附件，单个文件最大 10MB

### 2. 联网搜索功能

- 在输入框左侧添加联网开关按钮（🌐）
- 开启后，AI 在回答前会先搜索互联网获取最新信息
- 默认关闭，用户可手动开启

### 3. 思考过程开关

- 在输入框左侧添加思考过程开关按钮（🧠）
- 开启后，AI 会展示推理步骤和思考链
- 默认关闭，用户可手动开启

## Impact

### 受影响的文件

| 类型 | 文件 | 影响 |
|------|------|------|
| 组件 | `frontend/src/components/chat/MessageInput.vue` | 添加功能按钮和上传逻辑 |
| 新增 | `frontend/src/components/chat/AttachmentPreview.vue` | 附件预览组件 |
| 新增 | `frontend/src/composables/useFileUpload.ts` | 文件上传逻辑 |
| API | `backend/app/api/v1/chat.py` | 支持多模态输入 |
| API | `backend/app/api/v1/upload.py` | 新增文件上传端点 |
| 服务 | `backend/app/services/upload_service.py` | 文件处理服务 |

### 受影响的规范

- `openspec/specs/core-features/spec.md` - 聊天系统 API 变更

### 数据模型变更

```typescript
// 消息扩展
interface Message {
  // 现有字段...
  attachments?: Attachment[];  // 新增
  web_search_enabled?: boolean; // 新增
  thinking_enabled?: boolean;   // 新增
}

interface Attachment {
  id: string;
  filename: string;
  type: 'image' | 'document';
  url: string;
  size: number;
}
```

### API 变更

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | `/api/v1/upload` | 上传文件（新增） |
| POST | `/api/v1/chat/completions` | 支持 `attachments`、`web_search`、`thinking` 参数 |

### 风险

- **中等风险**：文件上传需要安全验证，防止恶意文件
- **低风险**：联网搜索需要额外 API 调用，可能增加延迟

## Scope

**包含**：
- 前端 UI 按钮和交互
- 附件上传和预览
- 后端文件处理
- API 参数扩展

**不包含**：
- 文件存储持久化方案（使用临时文件）
- 联网搜索的具体实现（依赖 LLM Provider 支持）
- 思考过程的后端实现（依赖模型能力）
