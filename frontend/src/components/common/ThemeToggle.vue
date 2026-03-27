<script setup lang="ts">
import { computed, h, type Component } from "vue";
import { NIcon } from "naive-ui";
import { useThemeStore, type ThemeMode } from "@/stores/theme";
import { SunnyOutline, MoonOutline, DesktopOutline } from "@vicons/ionicons5";

const themeStore = useThemeStore();

const options: { label: string; value: ThemeMode; icon: Component }[] = [
  { label: "亮色", value: "light", icon: SunnyOutline },
  { label: "暗色", value: "dark", icon: MoonOutline },
  { label: "跟随系统", value: "system", icon: DesktopOutline },
];

const currentIcon = computed(() => {
  if (themeStore.mode === "system") {
    return DesktopOutline;
  }
  return themeStore.resolvedMode === "dark" ? MoonOutline : SunnyOutline;
});

function handleSelect(key: ThemeMode) {
  themeStore.setMode(key);
}
</script>

<template>
  <NDropdown
    trigger="click"
    :options="
      options.map((opt) => ({
        label: opt.label,
        key: opt.value,
        icon: () => h(NIcon, { component: opt.icon, size: 16 }),
      }))
    "
    @select="handleSelect"
  >
    <NButton
      text
      class="theme-toggle-btn"
      :class="{ 'is-dark': themeStore.resolvedMode === 'dark' }"
    >
      <template #icon>
        <NIcon :component="currentIcon" size="20" />
      </template>
    </NButton>
  </NDropdown>
</template>

<style scoped>
.theme-toggle-btn {
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}

.theme-toggle-btn:hover {
  color: var(--color-primary);
}

.theme-toggle-btn.is-dark {
  color: var(--neon-cyan);
}
</style>
