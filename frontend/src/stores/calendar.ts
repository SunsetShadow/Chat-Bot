import { defineStore } from "pinia";
import { ref } from "vue";
import type { CalendarEvent, CreateEventRequest, UpdateEventRequest } from "@/types/calendar";
import * as api from "@/api/calendar";

export const useCalendarStore = defineStore("calendar", () => {
  const events = ref<CalendarEvent[]>([]);
  const cronEvents = ref<CalendarEvent[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function fetchEvents(timeMin?: string, timeMax?: string) {
    isLoading.value = true;
    error.value = null;
    try {
      const res = await api.getEvents(timeMin, timeMax);
      events.value = res.data;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "获取事件失败";
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchCronEvents(timeMin: string, timeMax: string) {
    try {
      const res = await api.getCronJobEvents(timeMin, timeMax);
      cronEvents.value = res.data;
    } catch {
      cronEvents.value = [];
    }
  }

  async function createEvent(data: CreateEventRequest) {
    const res = await api.createEvent(data);
    return res.data;
  }

  async function updateEvent(id: string, data: UpdateEventRequest) {
    const res = await api.updateEvent(id, data);
    return res.data;
  }

  async function deleteEvent(id: string) {
    await api.deleteEvent(id);
  }

  return {
    events, cronEvents, isLoading, error,
    fetchEvents, fetchCronEvents, createEvent, updateEvent, deleteEvent,
  };
});
