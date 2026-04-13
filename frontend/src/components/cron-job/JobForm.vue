<script setup lang="ts">
import { ref, computed, watch } from "vue";
import {
  NForm,
  NFormItem,
  NInput,
  NRadioGroup,
  NRadioButton,
  NInputNumber,
  NDatePicker,
  NSelect,
  NSwitch,
} from "naive-ui";
import type { FormInst } from "naive-ui";
import type { CreateJobRequest, JobType } from "@/types/cron-job";

const props = defineProps<{
  modelValue: CreateJobRequest;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: CreateJobRequest];
}>();

const formRef = ref<FormInst | null>(null);

const formValue = computed({
  get: () => props.modelValue,
  set: (val) => emit("update:modelValue", val),
});

const typeOptions: { label: string; value: JobType }[] = [
  { label: "Cron 表达式", value: "cron" },
  { label: "固定间隔", value: "every" },
  { label: "指定时间", value: "at" },
];

const intervalPresets = [
  { label: "30 秒", value: 30_000 },
  { label: "1 分钟", value: 60_000 },
  { label: "5 分钟", value: 300_000 },
  { label: "15 分钟", value: 900_000 },
  { label: "30 分钟", value: 1_800_000 },
  { label: "1 小时", value: 3_600_000 },
  { label: "6 小时", value: 21_600_000 },
  { label: "12 小时", value: 43_200_000 },
  { label: "24 小时", value: 86_400_000 },
];

const scheduleHint = computed(() => {
  switch (formValue.value.type) {
    case "cron":
      return "如: 0 8 * * * (每天 8:00)";
    case "every":
      return "设置任务执行的间隔时间";
    case "at":
      return "设置任务的一次性执行时间";
    default:
      return "";
  }
});

function updateField<K extends keyof CreateJobRequest>(key: K, value: CreateJobRequest[K]) {
  emit("update:modelValue", { ...props.modelValue, [key]: value });
}

function updateType(type: JobType) {
  const base = { ...props.modelValue, type };
  // 切换类型时清除其他类型的字段
  base.cron = type === "cron" ? (base.cron ?? "") : undefined;
  base.every_ms = type === "every" ? (base.every_ms ?? 60_000) : undefined;
  base.at = type === "at" ? (base.at ?? new Date().toISOString()) : undefined;
  emit("update:modelValue", base);
}

function updateAtTimestamp(ts: number) {
  if (ts) {
    updateField("at", new Date(ts).toISOString());
  }
}

const atTimestamp = computed(() => {
  if (formValue.value.at) {
    return new Date(formValue.value.at!).getTime();
  }
  return null;
});

function validate() {
  return formRef.value?.validate();
}

defineExpose({ validate });
</script>

<template>
  <NForm ref="formRef" :model="formValue" label-placement="left" label-width="100">
    <NFormItem label="任务指令" required>
      <NInput
        :value="formValue.instruction"
        type="textarea"
        :rows="3"
        placeholder="描述要执行的任务，如：总结今天的聊天记录并发送通知"
        @update:value="updateField('instruction', $event)"
      />
    </NFormItem>

    <NFormItem label="调度类型" required>
      <NRadioGroup :value="formValue.type" @update:value="updateType">
        <NRadioButton
          v-for="opt in typeOptions"
          :key="opt.value"
          :value="opt.value"
          :label="opt.label"
        />
      </NRadioGroup>
      <span class="schedule-hint">{{ scheduleHint }}</span>
    </NFormItem>

    <!-- Cron 表达式 -->
    <NFormItem v-if="formValue.type === 'cron'" label="Cron 表达式" required>
      <NInput
        :value="formValue.cron ?? ''"
        placeholder="0 8 * * *"
        @update:value="updateField('cron', $event)"
      />
    </NFormItem>

    <!-- 固定间隔 -->
    <NFormItem v-if="formValue.type === 'every'" label="执行间隔" required>
      <NSelect
        :value="formValue.every_ms ?? 60_000"
        :options="intervalPresets"
        @update:value="updateField('every_ms', $event)"
      />
    </NFormItem>

    <!-- 指定时间 -->
    <NFormItem v-if="formValue.type === 'at'" label="执行时间" required>
      <NDatePicker
        :value="atTimestamp"
        type="datetime"
        clearable
        style="width: 100%"
        @update:value="updateAtTimestamp"
      />
    </NFormItem>

    <!-- 高级选项 -->
    <NFormItem label="超时时间">
      <NInputNumber
        :value="formValue.timeout_ms ?? 60_000"
        :min="1000"
        :step="10_000"
        style="width: 100%"
        @update:value="updateField('timeout_ms', $event ?? 60_000)"
      >
        <template #suffix>ms</template>
      </NInputNumber>
    </NFormItem>

    <NFormItem label="重试次数">
      <NInputNumber
        :value="formValue.max_retries ?? 0"
        :min="0"
        :max="10"
        style="width: 100%"
        @update:value="updateField('max_retries', $event ?? 0)"
      />
    </NFormItem>
  </NForm>
</template>

<style scoped>
.schedule-hint {
  margin-left: 12px;
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-muted);
}
</style>
