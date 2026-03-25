# 消息渲染规范

## 支持的格式

| 格式 | 说明 | 库 |
|------|------|-----|
| Markdown | 基础 Markdown 语法 | marked / markdown-it |
| 代码高亮 | 语法高亮显示 | highlight.js / Prism |
| LaTeX | 数学公式 | KaTeX |
| 代码块 | 带语言标识的代码块 | 自定义组件 |
| 表格 | Markdown 表格 | marked 内置 |

## 渲染配置

- breaks: 启用换行符转 `<br>`
- gfm: 启用 GitHub Flavored Markdown
- linkify: 自动识别链接
- LaTeX 行内分隔符: `$...$`
- LaTeX 块级分隔符: `$$...$$`

## 安全处理

- 所有用户输入必须经过 XSS 过滤
- 外部链接添加 `rel="noopener noreferrer"` 和 `target="_blank"`
- 禁止 `javascript:` 和 `data:` 协议

## 消息组件结构

- `MessageItem` - 消息容器
  - `MessageHeader` - 头像、角色名、时间
  - `MessageContent` - 消息内容渲染
    - `MarkdownRenderer`
    - `CodeBlock`
    - `LatexRenderer`
  - `MessageActions` - 复制、重新生成等操作

## 约束

1. 所有用户输入必须经过 XSS 过滤
2. 代码块必须显示语言标识
3. 外部链接必须在新标签打开
4. 流式消息显示打字光标效果
5. 长消息支持折叠/展开
