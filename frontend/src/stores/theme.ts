// stores/theme.ts
import { defineStore } from "pinia";
import { ref } from "vue";

export type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "theme-mode";

export const useThemeStore = defineStore("theme", () => {
  const mode = ref<ThemeMode>("system");
  const resolvedMode = ref<"light" | "dark">("light");

  function getSystemPreference(): "light" | "dark" {
    if (typeof window === "undefined") return "light";
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  function applyTheme(theme: "light" | "dark") {
    resolvedMode.value = theme;
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }

  function setMode(newMode: ThemeMode) {
    mode.value = newMode;
    localStorage.setItem(STORAGE_KEY, newMode);
    const resolved = newMode === "system" ? getSystemPreference() : newMode;
    applyTheme(resolved);
  }

  function init() {
    // 从 localStorage 读取
    const stored = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
    if (stored && ["light", "dark", "system"].includes(stored)) {
      mode.value = stored;
    }

    // 应用主题
    const resolved =
      mode.value === "system" ? getSystemPreference() : mode.value;
    applyTheme(resolved);

    // 监听系统主题变化
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", (e) => {
      if (mode.value === "system") {
        applyTheme(e.matches ? "dark" : "light");
      }
    });
  }

  return {
    mode,
    resolvedMode,
    setMode,
    init,
  };
});
