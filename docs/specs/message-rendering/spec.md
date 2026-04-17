# 消息渲染规范

## 支持的格式

| 格式 | 说明 | 库 |
|------|------|-----|
| Markdown | 基础 Markdown + GFM | marked |
| 代码高亮 | 语法高亮显示 | highlight.js |
| 代码块 | 带语言标识的代码块 | marked 自定义 renderer |
| 表格 | Markdown 表格 | marked 内置（GFM） |

## 渲染配置

- breaks: 启用换行符转 `<br>`
- gfm: 启用 GitHub Flavored Markdown

## 安全处理

- 所有 HTML 输出经过 `sanitizeHtml()` 过滤（黑名单机制，移除 script/iframe/embed/object 等危险标签 + on* 事件属性 + javascript:/data: 协议）
- 外部链接添加 `rel="noopener noreferrer"` 和 `target="_blank"`
- 工具输出为字符串时同样经过 markdown 渲染 + XSS 过滤

## 关键文件

| 文件 | 用途 |
|------|------|
| `frontend/src/utils/markdown.ts` | Markdown 渲染配置 + XSS 过滤 + 自定义 renderer |
| `frontend/src/components/chat/MessageItem.vue` | 消息渲染组件（含流式打字光标） |
| `frontend/src/components/chat/ToolCallBlock.vue` | 工具调用展示组件（输出支持 markdown 渲染） |
| `frontend/src/assets/main.css` | `.markdown-body` 全局共享样式（table/ul/ol/li） |

## 约束

1. 所有渲染内容必须经过 XSS 过滤
2. 代码块必须显示语言标识
3. 外部链接必须在新标签打开
4. 流式消息显示打字光标效果（CSS blink 动画）
