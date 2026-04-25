import { get, post, del, patch } from "./request";
import type {
  CalendarEvent,
  CreateEventRequest,
  UpdateEventRequest,
} from "@/types/calendar";

const BASE = "/api/v1/calendar";

export async function getEvents(timeMin?: string, timeMax?: string) {
  const params: Record<string, string> = {};
  if (timeMin) params.timeMin = timeMin;
  if (timeMax) params.timeMax = timeMax;
  return get<{ success: boolean; data: CalendarEvent[] }>(`${BASE}/events`, params);
}

export async function getEvent(id: string) {
  return get<{ success: boolean; data: CalendarEvent }>(`${BASE}/events/${id}`);
}

export async function createEvent(data: CreateEventRequest) {
  return post<{ success: boolean; data: CalendarEvent }>(`${BASE}/events`, data);
}

export async function updateEvent(id: string, data: UpdateEventRequest) {
  return patch<{ success: boolean; data: CalendarEvent }>(`${BASE}/events/${id}`, data);
}

export async function deleteEvent(id: string) {
  return del<{ success: boolean }>(`${BASE}/events/${id}`);
}

export async function getCronJobEvents(timeMin: string, timeMax: string) {
  return get<{ success: boolean; data: CalendarEvent[] }>(`${BASE}/cron-events`, {
    timeMin,
    timeMax,
  });
}

export async function searchEvents(query: string) {
  return get<{ success: boolean; data: CalendarEvent[] }>(`${BASE}/search`, { q: query });
}
