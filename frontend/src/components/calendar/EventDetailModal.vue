<script setup lang="ts">
import { computed } from "vue";
import {
  NModal,
  NButton,
  NIcon,
  NSpace,
} from "naive-ui";
import { CreateOutline, TrashOutline, TimeOutline, LocationOutline, ReaderOutline, TimerOutline } from "@vicons/ionicons5";
import type { CalendarEvent } from "@/types/calendar";

const props = defineProps<{
  show: boolean;
  event: CalendarEvent | null;
}>();

const emit = defineEmits<{
  "update:show": [value: boolean];
  edit: [];
  delete: [id: string];
}>();

const isCronJob = computed(() => props.event?.source === "cron_job");

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTimeRange(): string {
  if (!props.event) return "";
  const start = formatTime(props.event.start_time);
  const end = props.event.end_time ? formatTime(props.event.end_time) : null;
  if (props.event.all_day) {
    return formatDate(props.event.start_time);
  }
  if (end) {
    return `${start} - ${end}`;
  }
  return start;
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :title="event?.title ?? '事件详情'"
    style="max-width: 440px"
    :mask-closable="true"
    @update:show="emit('update:show', $event)"
  >
    <template v-if="event" #header-extra>
      <span v-if="isCronJob" class="cron-badge">定时任务</span>
    </template>

    <div v-if="event" class="detail-body">
      <!-- Time -->
      <div class="detail-row">
        <div class="detail-icon">
          <NIcon :component="TimeOutline" :size="16" />
        </div>
        <div class="detail-content">
          <div class="detail-value">{{ formatTimeRange() }}</div>
          <div v-if="event.all_day" class="detail-tag">全天</div>
        </div>
      </div>

      <!-- Location -->
      <div v-if="event.location" class="detail-row">
        <div class="detail-icon">
          <NIcon :component="LocationOutline" :size="16" />
        </div>
        <div class="detail-content">
          <div class="detail-value">{{ event.location }}</div>
        </div>
      </div>

      <!-- Description -->
      <div v-if="event.description" class="detail-row">
        <div class="detail-icon">
          <NIcon :component="ReaderOutline" :size="16" />
        </div>
        <div class="detail-content">
          <div class="detail-value detail-desc">{{ event.description }}</div>
        </div>
      </div>
    </div>

    <template #action>
      <NSpace v-if="event && !isCronJob" justify="end" :size="8">
        <NButton type="error" ghost size="small" @click="emit('delete', event.id)">
          <template #icon>
            <NIcon :component="TrashOutline" :size="15" />
          </template>
          删除
        </NButton>
        <NButton type="primary" size="small" @click="emit('edit')">
          <template #icon>
            <NIcon :component="CreateOutline" :size="15" />
          </template>
          编辑
        </NButton>
      </NSpace>
      <div v-else class="flex justify-end">
        <NButton size="small" @click="emit('update:show', false)">关闭</NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.detail-body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 0;
}

.detail-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.detail-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  background: var(--color-primary-light);
  color: var(--color-primary);
  flex-shrink: 0;
}

.detail-content {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding-top: 3px;
}

.detail-value {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.detail-desc {
  font-weight: 400;
  color: var(--text-secondary);
  line-height: 1.5;
  white-space: pre-wrap;
}

.detail-tag {
  font-size: 11px;
  font-weight: 500;
  color: var(--color-secondary);
  background: rgba(16, 185, 129, 0.1);
  padding: 1px 8px;
  border-radius: var(--radius-full);
}

.cron-badge {
  font-size: 11px;
  font-weight: 600;
  color: var(--color-warning);
  background: rgba(245, 158, 11, 0.12);
  padding: 2px 10px;
  border-radius: var(--radius-full);
  letter-spacing: 0.02em;
}
</style>
