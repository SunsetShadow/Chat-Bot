<script setup lang="ts">
import { type Component } from "vue";
import { NButtonGroup, NButton, NIcon } from "naive-ui";
import { useThemeStore, type ThemeMode } from "@/stores/theme";
import { SunnyOutline, MoonOutline, DesktopOutline } from "@vicons/ionicons5";

const themeStore = useThemeStore();

const options: { label: string; value: ThemeMode; icon: Component }[] = [
  { label: "亮色", value: "light", icon: SunnyOutline },
  { label: "暗色", value: "dark", icon: MoonOutline },
  { label: "系统", value: "system", icon: DesktopOutline },
];

function isActive(mode: ThemeMode): boolean {
  return themeStore.mode === mode;
}
</script>

<template>
  <NButtonGroup size="small" class="theme-toggle-group">
    <NButton
      v-for="opt in options"
      :key="opt.value"
      :type="isActive(opt.value) ? 'primary' : 'default'"
      :class="{ 'is-active': isActive(opt.value) }"
      @click="themeStore.setMode(opt.value)"
    >
      <template #icon>
        <NIcon :component="opt.icon" size="16" />
      </template>
      {{ opt.label }}
    </NButton>
  </NButtonGroup>
</template>

<style scoped>
.theme-toggle-group {
  --n-button-color: var(--bg-tertiary);
  --n-button-text-color: var(--text-secondary);
}

.theme-toggle-group :deep(.n-button) {
  font-size: 12px;
  padding: 0 10px;
}

.theme-toggle-group :deep(.n-button.is-active) {
  font-weight: 500;
}
</style>
