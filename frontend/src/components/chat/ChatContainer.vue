<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useRouter } from "vue-router";
import SessionList from "./SessionList.vue";
import MessageList from "./MessageList.vue";
import MessageInput from "./MessageInput.vue";
import AgentSelector from "@/components/agent/AgentSelector.vue";
import AgentIndicator from "@/components/chat/AgentIndicator.vue";
import RuleEditor from "@/components/rules/RuleEditor.vue";
import ThemeToggle from "@/components/common/ThemeToggle.vue";
import NotificationBell from "@/components/common/NotificationBell.vue";
import AvatarFloat from '@/components/avatar/AvatarFloat.vue';
import { useChatStore } from "@/stores/chat";
import { useAgentStore } from "@/stores/agent";
import { useThemeStore, type ThemeMode } from "@/stores/theme";
import { useAIChat } from "@/composables/useAIChat";
import { useAvatarLayout } from '@/composables/useAvatarLayout';
import { NDrawer, NDrawerContent, NIcon, NPopover } from "naive-ui";
import {
  SettingsOutline,
  ReorderTwoOutline,
  EllipsisVerticalOutline,
  ExtensionPuzzleOutline,
  TabletLandscapeOutline,
  ExpandOutline,
  ContractOutline,
  CloseOutline,
  EyeOffOutline,
  SunnyOutline,
  MoonOutline,
  DesktopOutline,
  CalendarOutline,
} from "@vicons/ionicons5";

const router = useRouter();
const chatStore = useChatStore();
const agentStore = useAgentStore();
const themeStore = useThemeStore();

const themeOptions = [
  { label: '亮色', value: 'light' as ThemeMode, icon: SunnyOutline },
  { label: '暗色', value: 'dark' as ThemeMode, icon: MoonOutline },
  { label: '系统', value: 'system' as ThemeMode, icon: DesktopOutline },
];
const { loadMessages, clearMessages, activeAgent } = useAIChat();
const { avatarVisible, layoutMode } = useAvatarLayout();

const mobileDrawerOpen = ref(false);
const mobileActionsOpen = ref(false);

// 联动布局：Avatar side/fullscreen 模式下与聊天区共享空间
const isSideLayout = computed(() => avatarVisible.value && layoutMode.value === 'side');
const isFullarLayout = computed(() => avatarVisible.value && layoutMode.value === 'fullscreen');
// 分屏模式下隐藏会话列表，节省空间
const isSplitMode = computed(() => isSideLayout.value || isFullarLayout.value);

// 会话切换时同步历史消息到 AI SDK Chat 实例
watch(
  () => chatStore.currentSessionId,
  (newId) => {
    if (newId && chatStore.messages.length > 0) {
      loadMessages(chatStore.messages);
    } else if (!newId) {
      clearMessages();
    }
  },
);
</script>

<template>
  <div
    class="chat-shell"
    :class="{
      'chat-shell--side': isSideLayout,
      'chat-shell--fullscreen': isFullarLayout,
    }"
  >
    <!-- Avatar 面板（side/fullscreen 模式下嵌入文档流） -->
    <AvatarFloat
      v-if="avatarVisible && layoutMode !== 'float'"
      class="chat-shell__avatar"
    />

    <!-- 聊天区域 -->
    <div class="chat-main" :class="{ 'chat-main--split': isSplitMode }">
      <div class="flex h-full gap-2 md:gap-4" :class="isSplitMode ? 'p-1.5 md:p-2 gap-1.5 md:gap-2' : 'p-2 md:p-4'">
        <!-- 左侧会话列表（桌面端，分屏模式下隐藏） -->
        <aside
          v-if="!isSplitMode"
          class="hidden md:flex w-[256px] shrink-0 p-0 overflow-hidden relative bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl shadow-sm hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-primary)] transition-all duration-300"
        >
          <SessionList />
        </aside>

        <!-- 移动端侧边栏抽屉 -->
        <NDrawer v-model:show="mobileDrawerOpen" placement="left" :width="300">
          <NDrawerContent>
            <SessionList @session-selected="mobileDrawerOpen = false" />
          </NDrawerContent>
        </NDrawer>

        <!-- 主聊天区域 -->
        <main class="flex-1 flex flex-col min-w-0 gap-2 md:gap-4 min-h-0">
          <!-- 顶部工具栏 -->
          <header
            class="flex items-center justify-between px-3 md:px-4 h-10 bg-[var(--bg-secondary)] border border-[var(--border-color)] transition-all duration-300"
            :class="isSplitMode ? 'rounded-2xl' : 'rounded-2xl'"
          >
            <div class="flex items-center gap-2 md:gap-3">
              <!-- 汉堡菜单：移动端 + 分屏模式（替代隐藏的会话列表） -->
              <button
                :class="isSplitMode ? 'flex' : 'flex md:hidden'"
                class="items-center justify-center w-9 h-9 bg-transparent border border-[var(--border-color)] rounded-[var(--radius-sm)] text-[var(--text-muted)] cursor-pointer transition-all duration-150 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                @click="mobileDrawerOpen = true"
              >
                <NIcon :component="ReorderTwoOutline" :size="20" />
              </button>
              <AgentSelector />
              <AgentIndicator
                :agent-id="activeAgent || agentStore.currentAgentId || ''"
              />
            </div>
            <!-- 桌面端工具栏 -->
            <div class="hidden md:flex items-center gap-1.5">
              <RuleEditor />
              <NPopover trigger="click" placement="bottom-end" :width="120">
                <template #trigger>
                  <button
                    class="flex items-center justify-center w-8 h-8 bg-transparent border border-[var(--border-color)] rounded-[var(--radius-sm)] text-[var(--text-muted)] cursor-pointer transition-all duration-150 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                    title="主题"
                  >
                    <NIcon :component="themeStore.resolvedMode === 'dark' ? MoonOutline : SunnyOutline" :size="16" />
                  </button>
                </template>
                <div class="p-1">
                  <button
                    v-for="opt in themeOptions"
                    :key="opt.value"
                    class="theme-opt"
                    :class="{ 'is-active': themeStore.mode === opt.value }"
                    @click="themeStore.setMode(opt.value)"
                  >
                    <NIcon :component="opt.icon" :size="14" />
                    <span>{{ opt.label }}</span>
                  </button>
                </div>
              </NPopover>
              <button
                class="flex items-center justify-center w-8 h-8 bg-transparent border border-[var(--border-color)] rounded-[var(--radius-sm)] text-[var(--text-muted)] cursor-pointer transition-all duration-150 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                title="日历"
                @click="router.push('/calendar')"
              >
                <NIcon :component="CalendarOutline" :size="16" />
              </button>
              <button
                class="flex items-center justify-center w-8 h-8 bg-transparent border border-[var(--border-color)] rounded-[var(--radius-sm)] text-[var(--text-muted)] cursor-pointer transition-all duration-150 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                title="技能管理"
                @click="router.push('/skills')"
              >
                <NIcon :component="ExtensionPuzzleOutline" :size="16" />
              </button>
              <button
                class="flex items-center justify-center w-9 h-9 bg-transparent border border-[var(--border-color)] rounded-[var(--radius-sm)] text-[var(--text-muted)] cursor-pointer transition-all duration-150 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                title="设置"
                @click="router.push('/settings')"
              >
                <NIcon :component="SettingsOutline" :size="18" />
              </button>
              <NPopover trigger="click" placement="bottom-end" :width="180">
                <template #trigger>
                  <button
                    class="flex items-center justify-center w-9 h-9 bg-transparent border border-[var(--border-color)] rounded-[var(--radius-sm)] text-[var(--text-muted)] cursor-pointer transition-all duration-150 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                    :class="{ '!border-[var(--color-primary)] !text-[var(--color-primary)]': avatarVisible }"
                    title="Avatar"
                  >
                    🎭
                  </button>
                </template>
                <div class="flex flex-col gap-1 p-1">
                  <button
                    v-if="avatarVisible"
                    class="avatar-popover-item"
                    @click="layoutMode = layoutMode === 'float' ? 'side' : layoutMode === 'side' ? 'fullscreen' : 'float'"
                  >
                    <NIcon :component="layoutMode === 'float' ? ExpandOutline : layoutMode === 'side' ? ContractOutline : TabletLandscapeOutline" :size="14" />
                    <span>{{ layoutMode === 'float' ? '切换为侧栏' : layoutMode === 'side' ? '切换为全屏' : '切换为悬浮' }}</span>
                  </button>
                  <button
                    class="avatar-popover-item"
                    :class="{ 'is-active': avatarVisible }"
                    @click="avatarVisible = !avatarVisible"
                  >
                    <NIcon :component="avatarVisible ? EyeOffOutline : CloseOutline" :size="14" />
                    <span>{{ avatarVisible ? '隐藏 Avatar' : '显示 Avatar' }}</span>
                  </button>
                </div>
              </NPopover>
            </div>

            <!-- 移动端：省略号按钮，点击打开底部抽屉 -->
            <button
              class="flex md:hidden items-center justify-center w-9 h-9 bg-transparent border border-[var(--border-color)] rounded-[var(--radius-sm)] text-[var(--text-muted)] cursor-pointer transition-all duration-150 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
              @click="mobileActionsOpen = true"
            >
              <NIcon :component="EllipsisVerticalOutline" :size="18" />
            </button>
          </header>

          <!-- 移动端操作抽屉 -->
          <NDrawer
            v-model:show="mobileActionsOpen"
            placement="bottom"
            :height="280"
          >
            <NDrawerContent body-content-style="padding: 8px 16px 24px;">
              <div class="flex flex-col gap-1">
                <div class="flex items-center justify-between py-3">
                  <span class="text-[13px] text-[var(--text-secondary)]">主题</span>
                  <ThemeToggle />
                </div>
                <div class="flex items-center justify-between py-3">
                  <span class="text-[13px] text-[var(--text-secondary)]">规则</span>
                  <RuleEditor />
                </div>
                <button
                  class="flex items-center gap-3 w-full py-3 text-[13px] text-[var(--text-secondary)] cursor-pointer"
                  @click="
                    mobileActionsOpen = false;
                    router.push('/settings');
                  "
                >
                  <NIcon :component="SettingsOutline" :size="16" />
                  设置
                </button>
                <button
                  class="flex items-center gap-3 w-full py-3 text-[13px] text-[var(--text-secondary)] cursor-pointer"
                  @click="
                    mobileActionsOpen = false;
                    router.push('/calendar');
                  "
                >
                  <NIcon :component="CalendarOutline" :size="16" />
                  日历
                </button>
                <div class="h-px bg-[var(--border-color)] my-1"></div>
                <div class="flex items-center justify-between py-3">
                  <span class="text-[13px] text-[var(--text-secondary)]">Avatar</span>
                  <button
                    class="text-[13px] cursor-pointer"
                    :class="avatarVisible ? 'text-[var(--color-primary)]' : 'text-[var(--text-muted)]'"
                    @click="avatarVisible = !avatarVisible; mobileActionsOpen = false"
                  >
                    {{ avatarVisible ? '关闭' : '开启' }}
                  </button>
                </div>
                <div class="h-px bg-[var(--border-color)] my-1"></div>
                <div class="flex items-center justify-between py-3">
                  <span class="text-[13px] text-[var(--text-secondary)]">通知</span>
                  <NotificationBell />
                </div>
              </div>
            </NDrawerContent>
          </NDrawer>

          <!-- 消息列表 -->
          <div
            class="flex-1 overflow-hidden relative bg-[var(--bg-secondary)] border border-[var(--border-color)] transition-all duration-300"
            :class="isSplitMode ? 'rounded-2xl' : 'rounded-2xl shadow-sm hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-primary)]'"
          >
            <MessageList />
          </div>

          <!-- 输入区域 -->
          <div class="relative shrink-0">
            <MessageInput :is-empty="chatStore.messages.length === 0" />
          </div>
        </main>
      </div>
    </div>

    <!-- Avatar 悬浮窗（float 模式保持 fixed 覆盖） -->
    <AvatarFloat v-if="avatarVisible && layoutMode === 'float'" />
  </div>
</template>

<style scoped>
.chat-shell {
  position: relative;
  height: 100%;
}

/* side 模式：横向分栏，avatar 左 50% + 聊天右 50% */
.chat-shell--side {
  display: flex;
  flex-direction: row;
}

.chat-shell--side .chat-shell__avatar {
  width: 50%;
  flex-shrink: 0;
  border-right: 1px solid var(--border-color);
}

.chat-shell--side .chat-main {
  flex: 1;
  min-width: 0;
}

/* fullscreen 模式：纵向分屏，avatar 上 50% + 聊天下 50% */
.chat-shell--fullscreen {
  display: flex;
  flex-direction: column;
}

.chat-shell--fullscreen .chat-shell__avatar {
  height: 50%;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border-color);
}

.chat-shell--fullscreen .chat-main {
  flex: 1;
  min-height: 0;
}

.chat-main {
  height: 100%;
  overflow: hidden;
}

.avatar-popover-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.avatar-popover-item:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.avatar-popover-item.is-active {
  color: var(--color-primary);
}

.theme-opt {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 6px 10px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.theme-opt:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.theme-opt.is-active {
  color: var(--color-primary);
}
</style>
