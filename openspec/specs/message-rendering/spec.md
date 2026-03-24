# 消息渲染规范

## 概述

定义聊天消息的渲染规则，支持 Markdown、代码高亮、LaTeX 公式等富文本格式。

## 支持的格式

| 格式 | 说明 | 库 |
|------|------|-----|
| Markdown | 基础 Markdown 语法 | marked / markdown-it |
| 代码高亮 | 语法高亮显示 | highlight.js / Prism |
| LaTeX | 数学公式 | KaTeX |
| 代码块 | 带语言标识的代码块 | 自定义组件 |
| 表格 | Markdown 表格 | marked 内置 |

## 渲染规则

### Markdown 基础

```typescript
interface MarkdownConfig {
  breaks: true          // 换行符转 <br>
  gfm: true             // GitHub Flavored Markdown
  linkify: true         // 自动链接
  typographer: true     // 智能引号
}
```

### 代码块渲染

```vue
<!-- 代码块组件 -->
<template>
  <div class="code-block">
    <div class="code-header">
      <span class="language">{{ language }}</span>
      <button @click="copy">复制</button>
    </div>
    <pre><code :class="`language-${language}`"><slot /></code></pre>
  </div>
</template>
```

### LaTeX 公式

- 行内公式：`$E=mc^2$` → 行内渲染
- 块级公式：`$$E=mc^2$$` → 居中块级渲染

```typescript
interface LatexConfig {
  throwOnError: false   // 错误时不抛出
  displayMode: false    // 默认行内模式
  delimiters: {
    inline: ['$', '$']
    block: ['$$', '$$']
  }
}
```

## 安全处理

### XSS 防护

```typescript
// 必须对所有用户输入进行 sanitize
interface SanitizeConfig {
  allowedTags: string[]     // 允许的 HTML 标签
  allowedAttributes: object // 允许的属性
  disallowedProtocols: ['javascript:', 'data:']
}
```

### 链接处理

- 外部链接：添加 `rel="noopener noreferrer"` 和 `target="_blank"`
- 自动识别：URL 自动转为可点击链接

## 消息组件结构

```
MessageItem
├── MessageHeader     # 头像、角色名、时间
├── MessageContent    # 消息内容渲染
│   ├── MarkdownRenderer
│   ├── CodeBlock
│   └── LatexRenderer
└── MessageActions    # 复制、重新生成等操作
```

## 加载状态

```typescript
interface MessageStatus {
  type: 'streaming' | 'complete' | 'error'
  cursor?: string      // 流式光标动画
  error?: string       // 错误信息
}
```

## 约束

1. 所有用户输入必须经过 XSS 过滤
2. 代码块必须显示语言标识
3. 外部链接必须在新标签打开
4. 流式消息显示打字光标效果
5. 长消息支持折叠/展开
