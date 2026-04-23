<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useChatStore } from "@/stores/chat";
import { formatRelativeTime } from "@/utils/id";
import {
  AddOutline,
  ChatbubbleEllipsesOutline,
  TrashOutline,
  PushOutline,
  SearchOutline,
} from "@vicons/ionicons5";

const emit = defineEmits<{ "session-selected": [] }>();

const chatStore = useChatStore();

const searchQuery = ref("");
const showDeleteConfirm = ref(false);
const sessionToDelete = ref<string | null>(null);

const filteredSessions = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return chatStore.sessions;
  return chatStore.sessions.filter((s) =>
    s.title.toLowerCase().includes(q),
  );
});

const isSearchEmpty = computed(
  () =>
    searchQuery.value.trim() &&
    chatStore.sessions.length > 0 &&
    filteredSessions.value.length === 0,
);

onMounted(() => {
  chatStore.fetchSessions();
});

async function handleSelectSession(sessionId: string) {
  await chatStore.selectSession(sessionId);
  emit("session-selected");
}

function handleNewChat() {
  chatStore.clearCurrentSession();
  emit("session-selected");
}

function handlePinSession(sessionId: string, isPinned: boolean) {
  chatStore.pinSession(sessionId, !isPinned);
}

function openDeleteConfirm(sessionId: string) {
  sessionToDelete.value = sessionId;
  showDeleteConfirm.value = true;
}

function closeDeleteConfirm() {
  showDeleteConfirm.value = false;
  sessionToDelete.value = null;
}

async function confirmDelete() {
  if (sessionToDelete.value) {
    await chatStore.removeSession(sessionToDelete.value);
    closeDeleteConfirm();
  }
}
</script>

<template>
  <div class="flex flex-col h-full p-4 px-3 overflow-hidden">
    <!-- 头部 -->
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-base font-semibold text-[var(--text-primary)] tracking-tight">
        会话
      </h2>
      <button
        class="flex items-center justify-center w-8 h-8 border-none rounded-[var(--radius-sm)] text-[var(--text-muted)] cursor-pointer transition-all duration-150 hover:bg-[var(--bg-tertiary)] hover:text-[var(--color-primary)]"
        title="新对话"
        @click="handleNewChat"
      >
        <NIcon :component="AddOutline" :size="18" />
      </button>
    </div>

    <!-- 搜索框 -->
    <div class="mb-3">
      <NInput
        v-model:value="searchQuery"
        placeholder="搜索会话..."
        clearable
        size="small"
      >
        <template #prefix>
          <NIcon :component="SearchOutline" :size="14" />
        </template>
      </NInput>
    </div>

    <!-- 会话列表 -->
    <NScrollbar class="flex-1">
      <div v-if="chatStore.isLoading" class="flex justify-center p-10">
        <div
          class="w-6 h-6 border-2 border-[var(--border-color)] border-t-[var(--color-primary)] rounded-full animate-spin"
        ></div>
      </div>
      <div
        v-else-if="chatStore.sessions.length === 0"
        class="text-center py-10 px-5"
      >
        <div
          class="w-16 h-16 mx-auto mb-4 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-muted)]"
        >
          <NIcon :component="ChatbubbleEllipsesOutline" :size="32" />
        </div>
        <p class="text-sm text-[var(--text-secondary)] mb-1">暂无会话记录</p>
        <p class="text-xs text-[var(--text-muted)]">开始一段新对话吧</p>
      </div>
      <div v-else-if="isSearchEmpty" class="text-center py-10 px-5">
        <p class="text-sm text-[var(--text-muted)]">未找到匹配的会话</p>
      </div>
      <div v-else class="flex flex-col gap-2">
        <div
          v-for="session in filteredSessions"
          :key="session.id"
          class="session-item group relative flex items-center gap-3 pl-4 pr-3 py-3 rounded-[var(--radius-sm)] cursor-pointer transition-all duration-150"
          :class="chatStore.currentSessionId === session.id ? 'is-active' : ''"
          @click="handleSelectSession(session.id)"
        >
          <!-- 左侧选中竖条 -->
          <div
            v-if="chatStore.currentSessionId === session.id"
            class="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r bg-[var(--color-primary)]"
          ></div>
          <!-- 置顶图标 -->
          <div
            v-if="session.is_pinned"
            class="w-2 h-9 flex items-center justify-center shrink-0"
          >
            <div class="w-1.5 h-1.5 bg-[var(--color-primary)] rounded-sm"></div>
          </div>
          <div class="flex-1 min-w-0">
            <div
              class="text-[13px] font-medium text-[var(--text-primary)] truncate"
            >
              {{ session.title }}
            </div>
            <div
              class="flex items-center gap-1.5 font-mono text-[10px] text-[var(--text-muted)] mt-0.5"
            >
              <span>{{ session.message_count }} 条</span>
              <span class="opacity-50">·</span>
              <span>{{ formatRelativeTime(session.updated_at) }}</span>
            </div>
          </div>
          <!-- 操作按钮 -->
          <div
            class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <!-- 置顶按钮 -->
            <button
              class="p-1.5 border-none bg-transparent rounded-[var(--radius-sm)] cursor-pointer transition-all duration-150"
              :class="
                session.is_pinned
                  ? 'text-[var(--color-primary)] bg-[var(--color-primary-light)]'
                  : 'text-[var(--text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--bg-tertiary)]'
              "
              :title="session.is_pinned ? '取消置顶' : '置顶'"
              @click.stop="handlePinSession(session.id, session.is_pinned)"
            >
              <NIcon :component="PushOutline" :size="14" />
            </button>
            <!-- 删除按钮 -->
            <button
              class="p-1.5 border-none bg-transparent text-[var(--text-muted)] rounded-[var(--radius-sm)] cursor-pointer transition-all duration-150 hover:bg-[rgba(239,68,68,0.1)] hover:text-[var(--color-error)]"
              :title="'删除会话'"
              @click.stop="openDeleteConfirm(session.id)"
            >
              <NIcon :component="TrashOutline" :size="14" />
            </button>
          </div>
        </div>
      </div>
    </NScrollbar>

    <!-- 删除确认对话框 -->
    <NModal
      v-model:show="showDeleteConfirm"
      preset="dialog"
      title="确认删除"
      positive-text="确认"
      negative-text="取消"
      @positive-click="confirmDelete"
      @negative-click="closeDeleteConfirm"
    >
      <p class="text-[var(--text-secondary)]">
        确定要删除会话「{{
          chatStore.sessions.find((s) => s.id === sessionToDelete)?.title || ""
        }}
        」吗？
      </p>
      <p class="text-xs text-[var(--text-muted)]">此操作无法撤销。</p>
    </NModal>
  </div>
</template>

<style scoped>
.session-item:hover {
  background: var(--bg-tertiary);
}

.session-item.is-active {
  background: var(--color-primary-light);
}
</style>
