<script setup lang="ts">
import { onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { NIcon, NButton, NBadge, NPopover, NList, NListItem, NEmpty, NText, NButton as NButtonText } from "naive-ui";
import { NotificationsOutline, CheckmarkDoneOutline } from "@vicons/ionicons5";
import { useNotificationStore } from "@/stores/notification";

const store = useNotificationStore();
const router = useRouter();

onMounted(() => store.startPolling());
onUnmounted(() => store.stopPolling());

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "刚刚";
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  return `${Math.floor(hours / 24)} 天前`;
}

function goSession(sessionId: string | null) {
  if (sessionId) {
    store.showPanel = false;
    router.push({ path: "/", query: { session: sessionId } });
  }
}
</script>

<template>
  <NPopover
    trigger="click"
    :show="store.showPanel"
    placement="bottom-end"
    :width="360"
    @update:show="(v: boolean) => { store.showPanel = v; if (v) store.fetchNotifications(); }"
  >
    <template #trigger>
      <NButton text class="text-[var(--text-secondary)] hover:text-[var(--color-primary)] relative">
        <template #icon>
          <NBadge :value="store.unreadCount" :max="99" :offset="[4, -2]">
            <NIcon :component="NotificationsOutline" size="20" />
          </NBadge>
        </template>
      </NButton>
    </template>

    <div class="flex items-center justify-between mb-2 px-1">
      <span class="font-semibold text-sm">通知</span>
      <NButton
        v-if="store.unreadCount > 0"
        text
        size="tiny"
        class="text-[var(--color-primary)]"
        @click="store.markAllRead()"
      >
        全部已读
      </NButton>
    </div>

    <NList v-if="store.notifications.length" bordered size="small" class="max-h-80 overflow-y-auto">
      <NListItem
        v-for="n in store.notifications"
        :key="n.id"
        class="cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
        :class="{ 'opacity-60': n.is_read }"
        @click="store.markAsRead(n.id); goSession(n.session_id)"
      >
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2">
            <span v-if="!n.is_read" class="w-2 h-2 rounded-full bg-[var(--color-primary)] shrink-0" />
            <span class="text-sm font-medium truncate">{{ n.title }}</span>
          </div>
          <span class="text-xs text-[var(--text-secondary)] line-clamp-2">{{ n.content }}</span>
          <span class="text-xs text-[var(--text-tertiary)]">{{ timeAgo(n.created_at) }}</span>
        </div>
      </NListItem>
    </NList>
    <NEmpty v-else description="暂无通知" class="py-6" />
  </NPopover>
</template>
