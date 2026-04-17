import { marked } from "marked";
import hljs from "highlight.js";

// 配置 marked
marked.setOptions({
  gfm: true,
  breaks: true,
});

// 自定义渲染器
const renderer = new marked.Renderer();

// 代码块渲染 - 添加语言标识和复制按钮
renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
  const language = lang && hljs.getLanguage(lang) ? lang : "plaintext";
  const highlighted =
    lang && hljs.getLanguage(lang)
      ? hljs.highlight(text, { language }).value
      : text;

  // 使用 data-code 属性存储代码，由事件委托处理复制
  return `<div class="code-block">
  <div class="code-header">
    <span class="code-lang">${language}</span>
    <button class="copy-btn" data-code="${encodeURIComponent(text)}">复制</button>
  </div>
  <pre><code class="hljs language-${language}">${highlighted}</code></pre>
</div>`;
};

// 链接渲染 - 外部链接新窗口打开
renderer.link = function ({
  href,
  title,
  text,
}: {
  href: string;
  title?: string | null;
  text: string;
}) {
  const isExternal = href.startsWith("http://") || href.startsWith("https://");
  const externalAttrs = isExternal
    ? ' target="_blank" rel="noopener noreferrer"'
    : "";
  const titleAttr = title ? ` title="${title}"` : "";
  return `<a href="${href}"${titleAttr}${externalAttrs}>${text}</a>`;
};

marked.use({ renderer });

/**
 * 渲染 Markdown 为 HTML
 */
export function renderMarkdown(content: string): string {
  try {
    return marked.parse(content) as string;
  } catch {
    // 渲染失败时返回原始内容（转义）
    return escapeHtml(content);
  }
}

/**
 * HTML 转义
 */
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * XSS 过滤 - 移除危险标签和属性
 */
export function sanitizeHtml(html: string): string {
  // 移除危险标签及其内容
  const dangerousTags = [
    "script", "iframe", "embed", "object", "applet",
    "form", "meta", "link", "style", "base",
  ];
  for (const tag of dangerousTags) {
    html = html.replace(
      new RegExp(`<${tag}\\b[^<]*(?:(?!<\\/${tag}>)<[^<]*)*<\\/${tag}>`, "gi"),
      "",
    );
  }
  // 移除自闭合危险标签
  html = html.replace(/<(?:script|iframe|embed|object|applet|meta|base)\b[^>]*\/?>/gi, "");
  // 移除事件属性（on*="..."）
  html = html.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]*)/gi, "");
  // 移除 javascript: / vbscript: / data: 协议
  html = html.replace(/\b(?:javascript|vbscript|data)\s*:/gi, "blocked:");
  return html;
}

/**
 * 安全渲染 Markdown
 */
export function renderMarkdownSafe(content: string): string {
  return sanitizeHtml(renderMarkdown(content));
}
