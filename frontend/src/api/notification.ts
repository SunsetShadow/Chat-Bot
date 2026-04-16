import { get, post } from "./request";
import type { Notification } from "@/types/notification";

const BASE = "/api/v1/notifications";

export async function getNotifications(page = 1, perPage = 20) {
  return get<{ data: Notification[]; total: number; page: number; page_size: number }>(BASE, { page, per_page: perPage });
}

export async function getUnreadCount() {
  return get<{ success: boolean; data: { count: number } }>(`${BASE}/unread-count`);
}

export async function markAsRead(id: string) {
  return post<{ success: boolean }>(`${BASE}/${id}/read`);
}

export async function markAllRead() {
  return post<{ success: boolean }>(`${BASE}/read-all`);
}
