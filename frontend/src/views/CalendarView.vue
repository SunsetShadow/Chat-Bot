<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from "vue";
import { useRouter } from "vue-router";
import FullCalendar from "@fullcalendar/vue3";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import { NIcon, NSpin } from "naive-ui";
import { ChevronBackOutline, AddOutline, CalendarOutline } from "@vicons/ionicons5";
import { useCalendarStore } from "@/stores/calendar";
import type { CalendarEvent } from "@/types/calendar";
import EventDetailModal from "@/components/calendar/EventDetailModal.vue";
import EventFormModal from "@/components/calendar/EventFormModal.vue";
import type { EventClickArg, DateSelectArg } from "@fullcalendar/core";

const router = useRouter();
const store = useCalendarStore();

const showDetail = ref(false);
const showForm = ref(false);
const selectedEvent = ref<CalendarEvent | null>(null);
const formDefaults = ref<{ start_time?: string; end_time?: string }>({});
const calendarRef = ref<InstanceType<typeof FullCalendar> | null>(null);

const currentView = ref("dayGridMonth");
const titleText = ref("");
const defaultTitle = computed(() => {
  const now = new Date();
  return `${now.getFullYear()}年${now.getMonth() + 1}月`;
});

const allEvents = computed(() => {
  const toFcEvent = (e: CalendarEvent, bgColor?: string) => ({
    id: e.id,
    title: e.title,
    start: e.start_time,
    end: e.end_time ?? undefined,
    allDay: e.all_day,
    backgroundColor: bgColor ?? e.color ?? "#3b82f6",
    borderColor: "transparent",
    textColor: "#fff",
    extendedProps: { source: e.source, sourceId: e.source_id, description: e.description, location: e.location },
  });
  return [...store.events.map((e) => toFcEvent(e)), ...store.cronEvents.map((e) => toFcEvent(e, "#f59e0b"))];
});

const calendarOptions = computed(() => ({
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin],
  initialView: "dayGridMonth",
  headerToolbar: false,
  locale: "zh-cn",
  height: "calc(100vh - 110px)",
  editable: true,
  selectable: true,
  selectMirror: true,
  dayMaxEvents: 4,
  weekends: true,
  events: allEvents.value,
  eventClick: handleEventClick,
  select: handleDateSelect,
  eventDrop: handleEventDrop,
  datesSet: handleDatesSet,
  firstDay: 1,
  nowIndicator: true,
  eventTimeFormat: { hour: "2-digit", minute: "2-digit", hour12: false },
}));

function getApi() {
  return calendarRef.value?.getApi?.() ?? null;
}

const viewOptions = [
  { label: "月", value: "dayGridMonth" },
  { label: "周", value: "timeGridWeek" },
  { label: "日", value: "timeGridDay" },
  { label: "列表", value: "listWeek" },
];

function handleDatesSet(arg: { startStr: string; endStr: string; view: { title: string; type: string } }) {
  titleText.value = arg.view.title;
  currentView.value = arg.view.type;
  store.fetchEvents(arg.startStr, arg.endStr);
  store.fetchCronEvents(arg.startStr, arg.endStr);
}

function switchView(view: string) {
  getApi()?.changeView(view);
}

function navPrev() {
  getApi()?.prev();
}

function navNext() {
  getApi()?.next();
}

function navToday() {
  getApi()?.today();
}

function handleEventClick(info: EventClickArg) {
  const ext = info.event.extendedProps;
  const evt: CalendarEvent = {
    id: info.event.id,
    title: info.event.title,
    description: ext.description ?? null,
    start_time: info.event.start?.toISOString() ?? "",
    end_time: info.event.end?.toISOString() ?? null,
    all_day: info.event.allDay,
    color: info.event.backgroundColor,
    location: ext.location ?? null,
    remind_before_ms: null,
    recurrence_rule: null,
    source: ext.source ?? "calendar",
    source_id: ext.sourceId ?? null,
    agent_id: null,
    created_by_session: null,
    created_at: "",
    updated_at: "",
  };
  selectedEvent.value = evt;
  showDetail.value = true;
}

function handleDateSelect(info: DateSelectArg) {
  formDefaults.value = {
    start_time: info.start.toISOString(),
    end_time: info.end.toISOString(),
  };
  selectedEvent.value = null;
  showForm.value = true;
}

async function handleEventDrop(info: any) {
  const eventId = info.event.id;
  if (eventId.startsWith("cron-")) {
    info.revert();
    return;
  }
  try {
    await store.updateEvent(eventId, {
      start_time: info.event.start.toISOString(),
      end_time: info.event.end?.toISOString() ?? null,
    });
  } catch {
    info.revert();
  }
}

function getViewRange() {
  const api = getApi();
  if (api) {
    return { start: api.view.activeStart.toISOString(), end: api.view.activeEnd.toISOString() };
  }
  const now = new Date();
  return {
    start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
    end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString(),
  };
}

function refreshCurrentView() {
  const { start, end } = getViewRange();
  store.fetchEvents(start, end);
  store.fetchCronEvents(start, end);
}

async function handleDelete(id: string) {
  try {
    await store.deleteEvent(id);
    showDetail.value = false;
    refreshCurrentView();
  } catch {
    // error handled by store
  }
}

function handleSaved() {
  refreshCurrentView();
}

function openCreateModal() {
  selectedEvent.value = null;
  formDefaults.value = {};
  showForm.value = true;
}

function goBack() {
  router.push("/");
}

onMounted(() => {
  refreshCurrentView();
});
</script>

<template>
  <div class="calendar-page">
    <!-- Custom Header -->
    <header class="calendar-header">
      <div class="header-left">
        <button class="nav-btn back-btn" @click="goBack" title="返回">
          <NIcon :component="ChevronBackOutline" :size="20" />
        </button>
        <div class="header-brand">
          <NIcon :component="CalendarOutline" :size="18" class="brand-icon" />
          <h1 class="header-title">日历</h1>
        </div>
      </div>
      <div class="header-center">
        <div class="nav-group">
          <button class="nav-arrow" @click="navPrev" title="上一个">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <span class="title-text">{{ titleText || defaultTitle }}</span>
          <button class="nav-arrow" @click="navNext" title="下一个">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
        </div>
        <button class="today-btn" @click="navToday">今天</button>
      </div>
      <div class="header-right">
        <div class="view-switcher">
          <button
            v-for="opt in viewOptions"
            :key="opt.value"
            class="view-btn"
            :class="{ active: currentView === opt.value }"
            @click="switchView(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
        <button class="create-btn" @click="openCreateModal">
          <NIcon :component="AddOutline" :size="15" />
          <span>新建</span>
        </button>
      </div>
    </header>

    <!-- Calendar Body -->
    <div class="calendar-body">
      <NSpin :show="store.isLoading">
        <FullCalendar ref="calendarRef" :options="calendarOptions" />
      </NSpin>
    </div>

    <EventDetailModal
      v-model:show="showDetail"
      :event="selectedEvent"
      @edit="showDetail = false; showForm = true"
      @delete="handleDelete"
    />

    <EventFormModal
      v-model:show="showForm"
      :event="selectedEvent"
      :defaults="formDefaults"
      @saved="handleSaved"
    />
  </div>
</template>

<style scoped>
.calendar-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
  overflow: hidden;
}

/* === Header === */
.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  gap: 16px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.nav-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.nav-btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.brand-icon {
  color: var(--color-primary);
}

.header-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.header-center {
  display: flex;
  align-items: center;
  gap: 10px;
}

.nav-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.nav-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.nav-arrow:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.title-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  min-width: 90px;
  text-align: center;
}

.today-btn {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-primary);
  background: var(--color-primary-light);
  border: none;
  border-radius: var(--radius-sm);
  padding: 4px 10px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.today-btn:hover {
  background: var(--color-primary);
  color: #fff;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

/* View Switcher */
.view-switcher {
  display: flex;
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
  padding: 2px;
  gap: 1px;
}

.view-btn {
  font-size: 12px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: var(--radius-sm);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.view-btn:hover {
  color: var(--text-primary);
}

.view-btn.active {
  background: var(--color-primary);
  color: #fff;
}

/* Create Button */
.create-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 500;
  padding: 5px 12px;
  border-radius: var(--radius-md);
  border: none;
  background: var(--color-primary);
  color: #fff;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.create-btn:hover {
  background: var(--color-primary-hover);
}

/* === Calendar Body — fills remaining space === */
.calendar-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  padding: 0;
}

.calendar-body :deep(.n-spin-container) {
  height: 100%;
}

.calendar-body :deep(.n-spin-content) {
  height: 100%;
}

/* === FullCalendar Theme Overrides === */

.calendar-page :deep(.fc .fc-toolbar.fc-header-toolbar) {
  display: none !important;
}

.calendar-page :deep(.fc) {
  --fc-border-color: var(--border-subtle);
  --fc-today-bg-color: var(--color-primary-light);
  --fc-page-bg-color: transparent;
  --fc-neutral-bg-color: var(--bg-secondary);
  --fc-list-event-hover-bg-color: var(--bg-tertiary);
  --fc-event-bg-color: var(--color-primary);
  --fc-event-border-color: transparent;
  --fc-event-text-color: #fff;
  font-family: var(--font-display);
}

/* Scroll grid — fill width, no rounded corners (causes clip) */
.calendar-page :deep(.fc-scrollgrid) {
  border-left: none;
  border-right: none;
  border-radius: 0;
  background: var(--bg-secondary);
}

.calendar-page :deep(.fc-scrollgrid td),
.calendar-page :deep(.fc-scrollgrid th) {
  border-color: var(--border-subtle);
}

/* Day headers */
.calendar-page :deep(.fc-col-header-cell) {
  background: var(--bg-secondary);
  padding: 10px 0;
  border-bottom: 1px solid var(--border-color);
}

.calendar-page :deep(.fc-col-header-cell-cushion) {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 500;
  text-decoration: none;
}

/* Day cells */
.calendar-page :deep(.fc-daygrid-day) {
  transition: background var(--transition-fast);
}

.calendar-page :deep(.fc-daygrid-day:hover) {
  background: var(--bg-tertiary);
}

.calendar-page :deep(.fc-daygrid-day-number) {
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 500;
  padding: 4px 8px;
  text-decoration: none;
}

/* Other month */
.calendar-page :deep(.fc-day-other .fc-daygrid-day-number) {
  color: var(--text-muted);
  opacity: 0.4;
}

.calendar-page :deep(.fc-day-other) {
  background: transparent;
}

/* Today */
.calendar-page :deep(.fc-day-today) {
  background: var(--color-primary-light) !important;
}

.calendar-page :deep(.fc-day-today .fc-daygrid-day-number) {
  color: var(--color-primary);
  font-weight: 700;
}

/* Events */
.calendar-page :deep(.fc-event) {
  border-radius: 4px;
  font-size: 12px;
  font-weight: 500;
  padding: 1px 6px;
  border: none !important;
  cursor: pointer;
  transition: all var(--transition-fast);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
}

.calendar-page :deep(.fc-event:hover) {
  transform: scale(1.02);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
  z-index: 10;
}

/* More link */
.calendar-page :deep(.fc-more-link) {
  color: var(--color-primary);
  font-weight: 500;
  font-size: 11px;
}

/* List view */
.calendar-page :deep(.fc-list) {
  border-radius: 0;
  overflow: hidden;
}

.calendar-page :deep(.fc-list-day-cushion) {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
}

.calendar-page :deep(.fc-list-event td) {
  color: var(--text-primary);
  font-size: 13px;
}

.calendar-page :deep(.fc-list-event-time) {
  color: var(--text-secondary);
  font-size: 12px;
}

.calendar-page :deep(.fc-list-empty) {
  color: var(--text-muted);
  padding: 40px 0;
}

/* Time grid */
.calendar-page :deep(.fc-timegrid-slot) {
  height: 48px;
  border-color: var(--border-subtle);
}

.calendar-page :deep(.fc-timegrid-slot-label) {
  color: var(--text-muted);
  font-size: 11px;
}

.calendar-page :deep(.fc-timegrid-now-indicator-line) {
  border-color: var(--color-error);
  border-width: 2px;
}

.calendar-page :deep(.fc-timegrid-now-indicator-arrow) {
  border-color: var(--color-error);
}

/* Selection */
.calendar-page :deep(.fc-highlight) {
  background: var(--color-primary-light);
}

/* === Mobile === */
@media (max-width: 768px) {
  .calendar-header {
    padding: 8px 12px;
    flex-wrap: wrap;
    gap: 6px;
  }

  .header-center {
    order: 3;
    width: 100%;
    justify-content: center;
  }

  .title-text {
    font-size: 13px;
    min-width: 70px;
  }

  .view-btn {
    padding: 3px 7px;
    font-size: 11px;
  }

  .create-btn span {
    display: none;
  }

  .create-btn {
    padding: 5px 7px;
  }

  .today-btn {
    font-size: 11px;
    padding: 3px 7px;
  }
}
</style>
