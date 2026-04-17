import { defineStore } from "pinia";
import { ref } from "vue";
import type { Notification } from "@/types/notification";
import * as api from "@/api/notification";

export const useNotificationStore = defineStore("notification", () => {
  const notifications = ref<Notification[]>([]);
  const unreadCount = ref(0);
  const showPanel = ref(false);
  const toastQueue = ref<Notification[]>([]);
  let prevUnreadCount: number | null = null;

  let timer: ReturnType<typeof setInterval> | null = null;

  async function fetchUnreadCount() {
    try {
      const res = await api.getUnreadCount();
      const newCount = (res as any).data?.count ?? 0;

      // 首次加载只记录基线，不弹 toast
      if (prevUnreadCount !== null && newCount > prevUnreadCount) {
        const diff = newCount - prevUnreadCount;
        try {
          const notifRes = await api.getNotifications(1, diff);
          const items: Notification[] = (notifRes as any).data?.data ?? (notifRes as any).data ?? [];
          toastQueue.value.push(...items.filter((n) => !n.is_read));
        } catch { /* ignore */ }
      }

      unreadCount.value = newCount;
      prevUnreadCount = newCount;
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

  function consumeToasts(): Notification[] {
    const items = [...toastQueue.value];
    toastQueue.value = [];
    return items;
  }

  return {
    notifications, unreadCount, showPanel, toastQueue,
    fetchUnreadCount, fetchNotifications, markAsRead, markAllRead,
    togglePanel, startPolling, stopPolling, consumeToasts,
  };
});
