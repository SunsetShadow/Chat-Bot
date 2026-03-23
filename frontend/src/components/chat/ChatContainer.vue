<script setup lang="ts">
import SessionList from "./SessionList.vue";
import MessageList from "./MessageList.vue";
import MessageInput from "./MessageInput.vue";
import AgentSelector from "@/components/agent/AgentSelector.vue";
import RuleEditor from "@/components/rules/RuleEditor.vue";
</script>

<template>
  <div class="chat-container">
    <!-- 左侧会话列表 -->
    <aside class="chat-sidebar glass-card">
      <SessionList />
    </aside>

    <!-- 主聊天区域 -->
    <main class="chat-main">
      <!-- 顶部工具栏 -->
      <header class="chat-toolbar glass-card">
        <div class="toolbar-left">
          <AgentSelector />
        </div>
        <div class="toolbar-right">
          <RuleEditor />
          <div class="status-indicator">
            <div class="status-online" />
            <span class="status-text">在线</span>
          </div>
        </div>
      </header>

      <!-- 消息列表 -->
      <div class="messages-wrapper glass-card">
        <MessageList />
      </div>

      <!-- 输入区域 -->
      <div class="input-wrapper">
        <MessageInput />
      </div>
    </main>
  </div>
</template>

<style scoped>
.chat-container {
  display: flex;
  height: 100%;
  padding: 16px;
  gap: 16px;
}

.chat-sidebar {
  width: 280px;
  flex-shrink: 0;
  padding: 0;
  overflow: hidden;
  position: relative;
}

.chat-sidebar::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 80px;
  background: linear-gradient(180deg, var(--bg-glass) 0%, transparent 100%);
  pointer-events: none;
  z-index: 1;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 16px;
}

.chat-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  position: relative;
}

.chat-toolbar::after {
  content: "";
  position: absolute;
  bottom: 0;
  left: 24px;
  right: 24px;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    var(--border-glow),
    transparent
  );
}

.toolbar-left,
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-text {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--text-muted);
}

.messages-wrapper {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.input-wrapper {
  position: relative;
}

.input-wrapper::before {
  content: "";
  position: absolute;
  top: -16px;
  left: 0;
  right: 0;
  height: 32px;
  background: linear-gradient(180deg, transparent, var(--bg-primary));
  pointer-events: none;
  z-index: 1;
}
</style>
