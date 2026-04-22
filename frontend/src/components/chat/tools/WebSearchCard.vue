<script setup lang="ts">
import { computed, ref } from "vue";
import {
  SearchOutline,
  CheckmarkCircleOutline,
  AlertCircleOutline,
  ChevronDownOutline,
  ChevronUpOutline,
  OpenOutline,
} from "@vicons/ionicons5";

type ToolState =
  | "input-streaming"
  | "input-available"
  | "output-available"
  | "output-error";

const props = defineProps<{
  toolName: string;
  state: ToolState;
  input?: Record<string, unknown>;
  output?: unknown;
  errorText?: string;
}>();

const expanded = ref(false);
const DEFAULT_SHOW = 3;

interface SearchResult {
  title?: string;
  url?: string;
  summary?: string;
  snippet?: string;
  source?: string;
}

const query = computed(() => (props.input?.query as string) || "");

const results = computed<SearchResult[]>(() => {
  if (!props.output || typeof props.output !== "string") return [];
  try {
    const parsed = JSON.parse(props.output);
    if (Array.isArray(parsed)) return parsed;
    if (parsed.results && Array.isArray(parsed.results)) return parsed.results;
    return [];
  } catch {
    return [];
  }
});

const isRawText = computed(() => {
  return props.state === "output-available" && results.value.length === 0 && typeof props.output === "string";
});

const displayResults = computed(() =>
  expanded.value ? results.value : results.value.slice(0, DEFAULT_SHOW),
);

const hasMore = computed(() => results.value.length > DEFAULT_SHOW);

const stateIcon = computed(() => {
  if (props.state === "output-available") return CheckmarkCircleOutline;
  if (props.state === "output-error") return AlertCircleOutline;
  return null;
});

const stateLabel = computed(() => {
  switch (props.state) {
    case "input-streaming":
      return "搜索中...";
    case "input-available":
      return "准备搜索";
    case "output-available":
      return results.value.length > 0 ? `${results.value.length} 条结果` : "已完成";
    case "output-error":
      return "搜索失败";
    default:
      return "";
  }
});
</script>

<template>
  <div
    class="border border-[var(--border-color)] rounded-lg overflow-hidden"
  >
    <!-- Header -->
    <div class="flex items-center gap-2 px-3 py-2">
      <div class="flex items-center justify-center w-4 h-4">
        <div
          v-if="state === 'input-streaming' || state === 'input-available'"
          class="w-3 h-3 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin"
        ></div>
        <NIcon
          v-else-if="stateIcon"
          :component="stateIcon"
          :size="14"
          :class="state === 'output-error' ? 'text-red-400' : 'text-green-500'"
        />
      </div>
      <NIcon
        :component="SearchOutline"
        :size="13"
        class="text-[var(--color-primary)]"
      />
      <span class="font-mono text-xs text-[var(--color-primary)]">联网搜索</span>
      <span v-if="query" class="text-xs text-[var(--text-secondary)] truncate max-w-[200px]"
        >"{{ query }}"</span
      >
      <span class="font-mono text-[10px] text-[var(--text-muted)] ml-auto">{{ stateLabel }}</span>
    </div>

    <!-- Structured Results -->
    <div
      v-if="state === 'output-available' && results.length > 0"
      class="border-t border-[var(--border-color)]"
    >
      <div
        v-for="(item, i) in displayResults"
        :key="i"
        class="px-3 py-2 border-b border-[var(--border-color)] last:border-b-0 hover:bg-[var(--bg-tertiary)] transition-colors"
      >
        <div class="flex items-start gap-2">
          <span class="font-mono text-[10px] text-[var(--text-muted)] mt-0.5 shrink-0">{{
            i + 1
          }}</span>
          <div class="min-w-0 flex-1">
            <a
              v-if="item.url"
              :href="item.url"
              target="_blank"
              rel="noopener noreferrer"
              class="text-[13px] font-medium text-[var(--color-primary)] hover:underline flex items-center gap-1"
            >
              {{ item.title || item.url }}
              <NIcon :component="OpenOutline" :size="10" class="shrink-0" />
            </a>
            <span v-else class="text-[13px] font-medium text-[var(--text-primary)]">{{
              item.title || "无标题"
            }}</span>
            <p
              v-if="item.summary || item.snippet"
              class="text-[12px] text-[var(--text-secondary)] mt-0.5 line-clamp-2"
            >
              {{ item.summary || item.snippet }}
            </p>
          </div>
        </div>
      </div>
      <div
        v-if="hasMore"
        class="px-3 py-1.5 text-center cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
        @click="expanded = !expanded"
      >
        <span class="font-mono text-[11px] text-[var(--color-primary)] flex items-center justify-center gap-1">
          {{ expanded ? "收起" : `查看全部 ${results.length} 条` }}
          <NIcon :component="expanded ? ChevronUpOutline : ChevronDownOutline" :size="12" />
        </span>
      </div>
    </div>

    <!-- Raw text fallback -->
    <div
      v-else-if="isRawText"
      class="border-t border-[var(--border-color)] px-3 py-2"
    >
      <pre
        class="text-[12px] text-[var(--text-secondary)] whitespace-pre-wrap break-all font-mono leading-relaxed max-h-40 overflow-y-auto"
        >{{ output }}</pre
      >
    </div>

    <!-- Error -->
    <div
      v-if="state === 'output-error' && errorText"
      class="border-t border-[var(--border-color)] px-3 py-2 text-[12px] text-red-400"
    >
      {{ errorText }}
    </div>
  </div>
</template>
