# CSS 审计报告

## 1. main.css 自定义类分类

### 保留（全局样式/动画）
| 类名 | 用途 | 保留原因 |
|------|------|----------|
| `:root` 变量 | 设计 token | Tailwind 可引用 |
| `::-webkit-scrollbar-*` | 滚动条样式 | 无法用 Tailwind 实现 |
| `::selection` | 选中文本样式 | 全局样式 |
| `@keyframes *` | 动画定义 | Tailwind 可引用 |

### 迁移到 Tailwind
| 类名 | Tailwind 映射 |
|------|--------------|
| `.app-background` | `fixed inset-0 -z-10 bg-[var(--bg-primary)]` |
| `.glass-card` | `bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-sm hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-primary)] transition-all duration-300` |
| `.accent-text` | `text-[var(--color-primary)]` |
| `.accent-text-secondary` | `text-[var(--color-secondary)]` |
| `.typing-cursor` | `inline-block w-0.5 h-[1.2em] bg-[var(--color-primary)] ml-0.5 animate-pulse` |
| `.fade-in-up` | `animate-[fadeInUp_0.3s_ease-out_forwards]` |
| `.stagger-*` | `animation-delay-*` (Tailwind 内置) |
| `.status-online` | `w-2 h-2 bg-[var(--color-secondary)] rounded-full animate-pulse` |
| `.btn-primary` | `px-5 py-2.5 bg-[var(--color-primary)] text-white rounded-md font-medium hover:bg-[var(--color-primary-hover)] active:bg-[var(--color-primary-pressed)] transition-all duration-150` |
| `.btn-secondary` | `px-5 py-2.5 bg-transparent border border-[var(--border-color)] text-[var(--text-secondary)] rounded-md font-medium hover:bg-[var(--bg-tertiary)] hover:border-[var(--border-hover)] hover:text-[var(--text-primary)] transition-all duration-150` |
| `.label-mono` | `font-mono text-[11px] tracking-wider uppercase text-[var(--text-muted)]` |
| `.text-primary` | `text-[var(--text-primary)]` |
| `.text-secondary` | `text-[var(--text-secondary)]` |
| `.text-muted` | `text-[var(--text-muted)]` |
| `.bg-primary` | `bg-[var(--bg-primary)]` |
| `.bg-secondary` | `bg-[var(--bg-secondary)]` |
| `.bg-tertiary` | `bg-[var(--bg-tertiary)]` |

## 2. 组件内联样式 (<style scoped>)

需要迁移的组件：

| 组件 | 样式行数 | 主要类 |
|------|---------|--------|
| `HelloWorld.vue` | ~50 | 演示组件，可删除 |
| `agent/AgentEditor.vue` | 需检查 | agent-editor, agent-card 等 |
| `agent/AgentSelector.vue` | 需检查 | agent-selector, selector-label 等 |
| `chat/ChatContainer.vue` | 需检查 | chat-container, chat-main 等 |
| `chat/MessageInput.vue` | 需检查 | input-wrapper, char-count 等 |
| `chat/MessageItem.vue` | 需检查 | message, markdown-body 等 |
| `chat/MessageList.vue` | 需检查 | message-list 等 |
| `chat/SessionList.vue` | 需检查 | session, session-item 等 |
| `common/AppHeader.vue` | 需检查 | app-header, header-* 等 |
| `rules/RuleEditor.vue` | 需检查 | rule-editor, rule-* 等 |

## 3. 迁移策略

1. **main.css**: 删除可迁移的类，保留变量和无法用 Tailwind 实现的样式
2. **组件**: 将 `<style scoped>` 中的样式替换为 Tailwind 类

## 4. Tailwind 配置建议

需要扩展 tailwind.config.js 以支持自定义颜色：

```js
// tailwind.config.js
export default {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'var(--color-primary)',
          hover: 'var(--color-primary-hover)',
          pressed: 'var(--color-primary-pressed)',
        },
        secondary: 'var(--color-secondary)',
        // ... 其他颜色
      }
    }
  }
}
```

或者直接使用 CSS 变量语法：`text-[var(--color-primary)]`
