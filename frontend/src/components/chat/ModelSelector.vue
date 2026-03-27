<script setup lang="ts">
import { ref, computed, onMounted, type Component } from "vue";
import { NDropdown, NIcon, NTooltip } from "naive-ui";
import {
  ChevronDownOutline,
  SparklesOutline,
  RocketOutline,
  FlashOutline,
  DiamondOutline,
  PulseOutline,
} from "@vicons/ionicons5";
import { useModelStore, type Model } from "@/stores/model";

const props = defineProps<{
  sessionId?: string;
}>();

const emit = defineEmits<{
  change: [modelId: string];
}>();

const modelStore = useModelStore();

// Dropdown state
const showDropdown = ref(false);

// Current selected model
const selectedModel = computed(() => {
  if (props.sessionId && modelStore.getSessionModel(props.sessionId)) {
    return modelStore.getModelById(
      modelStore.getSessionModel(props.sessionId)!,
    );
  }
  return modelStore.defaultModel
    ? modelStore.getModelById(modelStore.defaultModel)
    : null;
});

// Get icon for model provider
function getModelIcon(model: Model | null | undefined): Component {
  if (!model) return SparklesOutline;

  const id = model.id.toLowerCase();
  if (id.includes("gpt-4") || id.includes("o1")) return RocketOutline;
  if (id.includes("gpt-3.5") || id.includes("flash")) return FlashOutline;
  if (id.includes("claude")) return DiamondOutline;
  if (id.includes("gemini")) return PulseOutline;
  return SparklesOutline;
}

// Get accent color class for model
function getModelAccentClass(model: Model | null | undefined): string {
  if (!model) return "accent-default";

  const id = model.id.toLowerCase();
  if (id.includes("gpt-4") || id.includes("o1")) return "accent-green";
  if (id.includes("gpt-3.5") || id.includes("flash")) return "accent-cyan";
  if (id.includes("claude")) return "accent-purple";
  if (id.includes("gemini")) return "accent-pink";
  return "accent-default";
}

// Custom render function for dropdown options
function renderOptionLabel(option: {
  label: string;
  key: string;
  disabled?: boolean;
  model: Model;
}) {
  const m = option.model;
  const icon = getModelIcon(m);
  const accentClass = getModelAccentClass(m);

  return h(
    "div",
    {
      class: ["model-option", accentClass, { "is-disabled": option.disabled }],
    },
    [
      h(NIcon, { component: icon, size: 14, class: "option-icon" }),
      h("div", { class: "option-content" }, [
        h("span", { class: "option-name" }, m.name),
        h("span", { class: "option-provider" }, m.provider.toUpperCase()),
      ]),
      m.context_length &&
        h(
          "span",
          { class: "option-context" },
          formatContextLength(m.context_length),
        ),
    ],
  );
}

// Format context length for display
function formatContextLength(length: number): string {
  if (length >= 1000000) return `${(length / 1000000).toFixed(1)}M`;
  if (length >= 1000) return `${Math.round(length / 1000)}K`;
  return String(length);
}

// Dropdown options with custom render
const options = computed(() =>
  modelStore.models.map((m) => ({
    label: m.name,
    key: m.id,
    disabled: !m.available,
    model: m,
    render: renderOptionLabel,
  })),
);

// Handle selection
function handleSelect(key: string) {
  if (props.sessionId) {
    modelStore.setSessionModel(props.sessionId, key);
  } else {
    modelStore.setDefaultModel(key);
  }
  showDropdown.value = false;
  emit("change", key);
}

// Import h from vue for render function
import { h } from "vue";

// Load models on mount
onMounted(async () => {
  if (modelStore.models.length === 0) {
    await modelStore.fetchModels();
  }
});
</script>

<template>
  <div class="model-selector">
    <NDropdown
      v-model:show="showDropdown"
      :options="options"
      trigger="click"
      placement="top-start"
      @select="handleSelect"
    >
      <NTooltip :disabled="showDropdown" placement="top">
        <template #trigger>
          <button
            class="model-button"
            :class="[
              getModelAccentClass(selectedModel),
              { 'is-open': showDropdown },
            ]"
          >
            <div class="model-icon-wrapper">
              <NIcon :component="getModelIcon(selectedModel)" :size="14" />
            </div>
            <span class="model-name">
              {{ selectedModel?.name || "选择模型" }}
            </span>
            <NIcon
              :component="ChevronDownOutline"
              :size="14"
              class="chevron"
              :class="{ 'is-open': showDropdown }"
            />
          </button>
        </template>
        切换模型
      </NTooltip>
    </NDropdown>
  </div>
</template>

<style scoped>
.model-selector {
  display: flex;
  align-items: center;
}

.model-button {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
}

.model-button:hover {
  border-color: var(--color-primary);
  color: var(--text-primary);
  background: var(--bg-hover);
}

.model-button:hover .model-icon-wrapper {
  color: var(--color-primary);
}

.model-button.is-open {
  border-color: var(--color-primary);
  background: var(--bg-hover);
}

/* Accent color variants */
.model-button.accent-green:hover,
.model-button.accent-green.is-open {
  border-color: var(--neon-green);
  box-shadow: 0 0 12px rgba(6, 214, 160, 0.2);
}
.model-button.accent-green:hover .model-icon-wrapper,
.model-button.accent-green.is-open .model-icon-wrapper {
  color: var(--neon-green);
}
.model-button.accent-green.is-open .chevron {
  color: var(--neon-green);
}

.model-button.accent-cyan:hover,
.model-button.accent-cyan.is-open {
  border-color: var(--neon-cyan);
  box-shadow: 0 0 12px rgba(0, 180, 216, 0.2);
}
.model-button.accent-cyan:hover .model-icon-wrapper,
.model-button.accent-cyan.is-open .model-icon-wrapper {
  color: var(--neon-cyan);
}
.model-button.accent-cyan.is-open .chevron {
  color: var(--neon-cyan);
}

.model-button.accent-purple:hover,
.model-button.accent-purple.is-open {
  border-color: var(--neon-purple);
  box-shadow: 0 0 12px rgba(155, 93, 229, 0.2);
}
.model-button.accent-purple:hover .model-icon-wrapper,
.model-button.accent-purple.is-open .model-icon-wrapper {
  color: var(--neon-purple);
}
.model-button.accent-purple.is-open .chevron {
  color: var(--neon-purple);
}

.model-button.accent-pink:hover,
.model-button.accent-pink.is-open {
  border-color: var(--neon-pink);
  box-shadow: 0 0 12px rgba(247, 37, 133, 0.2);
}
.model-button.accent-pink:hover .model-icon-wrapper,
.model-button.accent-pink.is-open .model-icon-wrapper {
  color: var(--neon-pink);
}
.model-button.accent-pink.is-open .chevron {
  color: var(--neon-pink);
}

.model-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
  transition: color var(--transition-fast);
}

.model-name {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chevron {
  color: var(--text-muted);
  transition:
    transform var(--transition-fast),
    color var(--transition-fast);
}

.chevron.is-open {
  transform: rotate(180deg);
  color: var(--color-primary);
}

/* Dark theme glow effects */
:root.dark .model-button.is-open {
  text-shadow: 0 0 8px var(--color-primary);
}

:root.dark .model-button.accent-green.is-open {
  text-shadow: 0 0 8px var(--neon-green);
  box-shadow: 0 0 16px rgba(6, 214, 160, 0.3);
}
:root.dark .model-button.accent-cyan.is-open {
  text-shadow: 0 0 8px var(--neon-cyan);
  box-shadow: 0 0 16px rgba(0, 180, 216, 0.3);
}
:root.dark .model-button.accent-purple.is-open {
  text-shadow: 0 0 8px var(--neon-purple);
  box-shadow: 0 0 16px rgba(155, 93, 229, 0.3);
}
:root.dark .model-button.accent-pink.is-open {
  text-shadow: 0 0 8px var(--neon-pink);
  box-shadow: 0 0 16px rgba(247, 37, 133, 0.3);
}
</style>

<!-- Global styles for dropdown menu (unscoped) -->
<style>
.model-dropdown-menu {
  background: var(--bg-secondary) !important;
  border: 1px solid var(--border-color) !important;
  border-radius: var(--radius-md) !important;
  box-shadow: var(--shadow-lg) !important;
  padding: 6px !important;
  min-width: 260px !important;
  backdrop-filter: blur(12px);
}

:root.dark .model-dropdown-menu {
  border-color: var(--neon-cyan) !important;
  box-shadow: 0 0 24px rgba(0, 240, 255, 0.15) !important;
}

.model-dropdown-menu .n-dropdown-option {
  padding: 0 !important;
  margin: 2px 0 !important;
}

.model-dropdown-menu .n-dropdown-option-body {
  padding: 8px 12px !important;
  border-radius: var(--radius-sm) !important;
}

.model-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0;
}

.model-option.is-disabled {
  opacity: 0.5;
  pointer-events: none;
}

.model-option .option-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}

.model-option .option-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.model-option .option-name {
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.model-option .option-provider {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.5px;
}

.model-option .option-context {
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--text-muted);
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

/* Hover states with accent colors */
.model-dropdown-menu .n-dropdown-option-body:hover {
  background: var(--bg-hover) !important;
}

.model-dropdown-menu .n-dropdown-option-body:hover .option-icon {
  color: var(--color-primary);
}

/* Accent color hover states */
.model-option.accent-green .option-icon {
  color: var(--neon-green);
}
.model-option.accent-cyan .option-icon {
  color: var(--neon-cyan);
}
.model-option.accent-purple .option-icon {
  color: var(--neon-purple);
}
.model-option.accent-pink .option-icon {
  color: var(--neon-pink);
}

:root.dark .model-dropdown-menu .n-dropdown-option-body:hover {
  background: rgba(0, 240, 255, 0.08) !important;
}
</style>
