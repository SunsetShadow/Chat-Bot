<script setup lang="ts">
import { ref, watch, computed } from "vue";
import {
  NModal,
  NForm,
  NFormItem,
  NInput,
  NDatePicker,
  NButton,
  NSwitch,
  useMessage,
} from "naive-ui";
import { useCalendarStore } from "@/stores/calendar";
import type { CalendarEvent } from "@/types/calendar";

const props = defineProps<{
  show: boolean;
  event: CalendarEvent | null;
  defaults?: { start_time?: string; end_time?: string };
}>();

const emit = defineEmits<{
  "update:show": [value: boolean];
  saved: [];
}>();

const store = useCalendarStore();
const message = useMessage();
const saving = ref(false);

const isEdit = computed(() => !!props.event);

const title = ref("");
const description = ref("");
const startTime = ref<number | null>(null);
const endTime = ref<number | null>(null);
const allDay = ref(false);
const location = ref("");
const color = ref<string | null>(null);

const colorOptions = [
  { label: "蓝色", value: "#3b82f6" },
  { label: "翠绿", value: "#10b981" },
  { label: "琥珀", value: "#f59e0b" },
  { label: "玫红", value: "#ef4444" },
  { label: "紫罗兰", value: "#8b5cf6" },
  { label: "粉红", value: "#ec4899" },
];

watch(
  () => props.show,
  (visible) => {
    if (!visible) return;
    if (props.event) {
      title.value = props.event.title;
      description.value = props.event.description ?? "";
      startTime.value = props.event.start_time ? new Date(props.event.start_time).getTime() : null;
      endTime.value = props.event.end_time ? new Date(props.event.end_time).getTime() : null;
      allDay.value = props.event.all_day;
      location.value = props.event.location ?? "";
      color.value = props.event.color;
    } else {
      title.value = "";
      description.value = "";
      startTime.value = props.defaults?.start_time ? new Date(props.defaults.start_time).getTime() : null;
      endTime.value = props.defaults?.end_time ? new Date(props.defaults.end_time).getTime() : null;
      allDay.value = false;
      location.value = "";
      color.value = null;
    }
  },
);

async function handleSubmit() {
  if (!title.value.trim()) {
    message.warning("请输入事件标题");
    return;
  }
  if (!startTime.value) {
    message.warning("请选择开始时间");
    return;
  }

  saving.value = true;
  try {
    if (isEdit.value && props.event) {
      await store.updateEvent(props.event.id, {
        title: title.value,
        description: description.value || null,
        start_time: new Date(startTime.value).toISOString(),
        end_time: endTime.value ? new Date(endTime.value).toISOString() : null,
        all_day: allDay.value,
        location: location.value || null,
        color: color.value,
      });
      message.success("事件已更新");
    } else {
      await store.createEvent({
        title: title.value,
        description: description.value || undefined,
        start_time: new Date(startTime.value).toISOString(),
        end_time: endTime.value ? new Date(endTime.value).toISOString() : undefined,
        all_day: allDay.value,
        location: location.value || undefined,
        color: color.value ?? undefined,
      });
      message.success("事件已创建");
    }
    emit("saved");
    emit("update:show", false);
  } catch (e) {
    message.error(e instanceof Error ? e.message : "操作失败");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :title="isEdit ? '编辑事件' : '新建事件'"
    style="max-width: 440px"
    :mask-closable="true"
    @update:show="emit('update:show', $event)"
  >
    <NForm label-placement="left" label-width="72" size="small" class="event-form">
      <NFormItem label="标题">
        <NInput v-model:value="title" placeholder="事件标题" />
      </NFormItem>
      <NFormItem label="开始时间">
        <NDatePicker
          v-model:value="startTime"
          type="datetime"
          clearable
          style="width: 100%"
        />
      </NFormItem>
      <NFormItem label="结束时间">
        <NDatePicker
          v-model:value="endTime"
          type="datetime"
          clearable
          style="width: 100%"
        />
      </NFormItem>
      <NFormItem label="全天">
        <NSwitch v-model:value="allDay" />
      </NFormItem>
      <NFormItem label="地点">
        <NInput v-model:value="location" placeholder="可选" />
      </NFormItem>
      <NFormItem label="描述">
        <NInput
          v-model:value="description"
          type="textarea"
          :rows="2"
          placeholder="可选"
        />
      </NFormItem>
      <NFormItem label="颜色">
        <div class="color-picker">
          <button
            v-for="opt in colorOptions"
            :key="opt.value"
            class="color-dot"
            :class="{ active: color === opt.value }"
            :style="{ backgroundColor: opt.value }"
            :title="opt.label"
            @click="color = color === opt.value ? null : opt.value"
          />
        </div>
      </NFormItem>
    </NForm>

    <template #action>
      <div class="flex gap-2 justify-end">
        <NButton @click="emit('update:show', false)">取消</NButton>
        <NButton type="primary" :loading="saving" @click="handleSubmit">
          {{ isEdit ? "保存" : "创建" }}
        </NButton>
      </div>
    </template>
  </NModal>
</template>

<style scoped>
.event-form {
  padding: 4px 0;
}

.color-picker {
  display: flex;
  gap: 8px;
  align-items: center;
}

.color-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all var(--transition-fast);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}

.color-dot:hover {
  transform: scale(1.15);
}

.color-dot.active {
  border-color: var(--text-primary);
  transform: scale(1.15);
  box-shadow: 0 0 0 2px var(--bg-primary), 0 0 0 4px var(--text-primary);
}
</style>
