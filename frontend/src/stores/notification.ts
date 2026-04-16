import { defineStore } from "pinia";
import { ref } from "vue";
import type { Notification } from "@/types/notification";
import * as api from "@/api/notification";

export const useNotificationStore = defineStore("notification", () => {
  const notifications = ref<Notification[]>([]);
  const unreadCount = ref(0);
  const showPanel = ref(false);

  let timer: ReturnType<typeof setInterval> | null = null;

  async function fetchUnreadCount() {
    try {
      const res = await api.getUnreadCount();
      unreadCount.value = (res as any).data?.count ?? res.data?.count ?? 0;
    } catch { /* ignore */ }
  }

  async function fetchNotifications() {
    try {
      const res = await api.getNotifications(1, 20);
      // 后端返回 { success, data: { data: [...], total, ... } }
      notifications.value = (res as any).data?.data ?? (res as any).data ?? [];
    } catch { /* ignore */ }
  }

  async function markAsRead(id: string) {
    await api.markAsRead(id);
    const n = notifications.value.find((n) => n.id === id);
    if (n) n.is_read = true;
    await fetchUnreadCount();
  }

  async function markAllRead() {
    await api.markAllRead();
    notifications.value.forEach((n) => (n.is_read = true));
    unreadCount.value = 0;
  }

  function togglePanel() {
    showPanel.value = !showPanel.value;
    if (showPanel.value) fetchNotifications();
  }

  function startPolling(intervalMs = 30000) {
    stopPolling();
    fetchUnreadCount();
    timer = setInterval(fetchUnreadCount, intervalMs);
  }

  function stopPolling() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  return {
    notifications, unreadCount, showPanel,
    fetchUnreadCount, fetchNotifications, markAsRead, markAllRead,
    togglePanel, startPolling, stopPolling,
  };
});
