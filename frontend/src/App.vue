<script setup lang="ts">
import {
  NConfigProvider,
  NMessageProvider,
  NDialogProvider,
  NNotificationProvider,
  zhCN,
  dateZhCN,
  darkTheme,
  type GlobalThemeOverrides,
} from "naive-ui";
import { computed, onMounted } from "vue";
import { useThemeStore } from "@/stores/theme";

const themeStore = useThemeStore();

onMounted(() => {
  themeStore.init();
});

// 亮色主题配置
const lightThemeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: "#3b82f6",
    primaryColorHover: "#2563eb",
    primaryColorPressed: "#1d4ed8",
    primaryColorSuppl: "#3b82f6",

    fontFamily: "Sora, sans-serif",
    fontFamilyMono: "JetBrains Mono, monospace",

    borderRadius: "10px",
    borderRadiusSmall: "6px",

    textColorBase: "#1e293b",
    textColor1: "#1e293b",
    textColor2: "#64748b",
    textColor3: "#94a3b8",
    textColorDisabled: "#cbd5e1",

    placeholderColor: "#94a3b8",
    placeholderColorDisabled: "#cbd5e1",

    boxShadow1: "0 1px 3px rgba(0, 0, 0, 0.1)",
    boxShadow2: "0 4px 6px rgba(0, 0, 0, 0.07)",
    boxShadow3: "0 10px 15px rgba(0, 0, 0, 0.1)",

    borderColor: "#e2e8f0",
    dividerColor: "#e2e8f0",
  },
  Card: {
    color: "#ffffff",
    colorModal: "#ffffff",
    borderColor: "#e2e8f0",
    titleTextColor: "#1e293b",
    textColor: "#64748b",
    borderRadius: "16px",
  },
  Button: {
    textColorPrimary: "#ffffff",
    textColorHoverPrimary: "#ffffff",
    textColorPressedPrimary: "#ffffff",
    colorPrimary: "#3b82f6",
    colorHoverPrimary: "#2563eb",
    colorPressedPrimary: "#1d4ed8",
    borderRadiusMedium: "8px",
    fontWeight: "500",
  },
  Input: {
    color: "#ffffff",
    colorFocus: "#ffffff",
    borderColor: "#e2e8f0",
    borderColorHover: "#cbd5e1",
    borderColorFocus: "#3b82f6",
    boxShadowFocus: "0 0 0 3px rgba(59, 130, 246, 0.1)",
    textColor: "#1e293b",
    caretColor: "#3b82f6",
    borderRadius: "10px",
  },
  Select: {
    peers: {
      InternalSelection: {
        textColor: "#1e293b",
        color: "#ffffff",
        colorActive: "#ffffff",
        border: "1px solid #e2e8f0",
        borderHover: "1px solid #cbd5e1",
        borderActive: "1px solid #3b82f6",
        boxShadowActive: "0 0 0 3px rgba(59, 130, 246, 0.1)",
        borderRadius: "10px",
      },
      InternalSelectMenu: {
        color: "#ffffff",
        optionTextColor: "#1e293b",
        optionTextColorActive: "#3b82f6",
        borderRadius: "10px",
      },
    },
  },
  Modal: {
    color: "#ffffff",
    borderRadius: "16px",
  },
  Tabs: {
    tabTextColorLine: "#64748b",
    tabTextColorActiveLine: "#3b82f6",
    tabTextColorHoverLine: "#3b82f6",
    barColor: "#3b82f6",
    tabBorderColor: "#e2e8f0",
  },
  Tag: {
    borderRadius: "6px",
  },
  Switch: {
    railColorActive: "#3b82f6",
  },
  Scrollbar: {
    color: "rgba(0, 0, 0, 0.15)",
  },
  Message: {
    textColor: "#1e293b",
  },
  Dialog: {
    textColor: "#1e293b",
    titleTextColor: "#1e293b",
  },
};

// 暗色简约主题配置
const darkThemeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: "#5b9cf6",
    primaryColorHover: "#7db3f8",
    primaryColorPressed: "#4a8ae0",
    primaryColorSuppl: "#5b9cf6",

    fontFamily: "Sora, sans-serif",
    fontFamilyMono: "JetBrains Mono, monospace",

    borderRadius: "10px",
    borderRadiusSmall: "6px",

    textColorBase: "#eef1f6",
    textColor1: "#eef1f6",
    textColor2: "#9ca8b8",
    textColor3: "#6b7b8d",
    textColorDisabled: "#4a5568",

    placeholderColor: "#6b7b8d",
    placeholderColorDisabled: "#4a5568",

    boxShadow1: "0 2px 4px rgba(0, 0, 0, 0.2)",
    boxShadow2: "0 4px 8px rgba(0, 0, 0, 0.25)",
    boxShadow3: "0 8px 16px rgba(0, 0, 0, 0.3)",

    borderColor: "rgba(148, 163, 184, 0.12)",
    dividerColor: "rgba(148, 163, 184, 0.1)",
  },
  Card: {
    color: "#1a1f2e",
    colorModal: "#1a1f2e",
    borderColor: "rgba(148, 163, 184, 0.12)",
    titleTextColor: "#eef1f6",
    textColor: "#9ca8b8",
    borderRadius: "16px",
  },
  Button: {
    textColorPrimary: "#ffffff",
    textColorHoverPrimary: "#ffffff",
    textColorPressedPrimary: "#ffffff",
    colorPrimary: "#5b9cf6",
    colorHoverPrimary: "#7db3f8",
    colorPressedPrimary: "#4a8ae0",
    borderRadiusMedium: "8px",
    fontWeight: "500",
  },
  Input: {
    color: "#222836",
    colorFocus: "#222836",
    borderColor: "rgba(148, 163, 184, 0.12)",
    borderColorHover: "rgba(148, 163, 184, 0.22)",
    borderColorFocus: "#5b9cf6",
    boxShadowFocus: "0 0 0 3px rgba(91, 156, 246, 0.15)",
    textColor: "#eef1f6",
    caretColor: "#5b9cf6",
    borderRadius: "10px",
  },
  Select: {
    peers: {
      InternalSelection: {
        textColor: "#eef1f6",
        color: "#222836",
        colorActive: "#222836",
        border: "1px solid rgba(148, 163, 184, 0.12)",
        borderHover: "1px solid rgba(148, 163, 184, 0.22)",
        borderActive: "1px solid #5b9cf6",
        boxShadowActive: "0 0 0 3px rgba(91, 156, 246, 0.15)",
        borderRadius: "10px",
      },
      InternalSelectMenu: {
        color: "#1a1f2e",
        optionTextColor: "#eef1f6",
        optionTextColorActive: "#5b9cf6",
        borderRadius: "10px",
      },
    },
  },
  Modal: {
    color: "#1a1f2e",
    borderRadius: "16px",
  },
  Tabs: {
    tabTextColorLine: "#9ca8b8",
    tabTextColorActiveLine: "#5b9cf6",
    tabTextColorHoverLine: "#5b9cf6",
    barColor: "#5b9cf6",
    tabBorderColor: "rgba(148, 163, 184, 0.12)",
  },
  Tag: {
    borderRadius: "6px",
  },
  Switch: {
    railColorActive: "#5b9cf6",
  },
  Scrollbar: {
    color: "rgba(148, 163, 184, 0.2)",
  },
  Message: {
    textColor: "#eef1f6",
  },
  Dialog: {
    textColor: "#eef1f6",
    titleTextColor: "#eef1f6",
  },
};

const currentTheme = computed(() =>
  themeStore.resolvedMode === "dark" ? darkTheme : null,
);

const currentThemeOverrides = computed(() =>
  themeStore.resolvedMode === "dark" ? darkThemeOverrides : lightThemeOverrides,
);
</script>

<template>
  <NConfigProvider
    :locale="zhCN"
    :date-locale="dateZhCN"
    :theme="currentTheme"
    :theme-overrides="currentThemeOverrides"
  >
    <NMessageProvider>
      <NDialogProvider>
        <NNotificationProvider>
          <div class="app-background" />
          <RouterView />
        </NNotificationProvider>
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>

<style>
/* Naive UI Overrides - Light Theme */
:root:not(.dark) .n-button--primary-type {
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2) !important;
}

:root:not(.dark) .n-button--primary-type:hover {
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3) !important;
}

:root:not(.dark) .n-input:focus-within {
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
}

:root:not(.dark) .n-card {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1) !important;
}

:root:not(.dark) .n-card:hover {
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15) !important;
}

:root:not(.dark) .n-modal {
  box-shadow: 0 20px 25px rgba(0, 0, 0, 0.15) !important;
}

/* Naive UI Overrides - Dark Theme */
:root.dark .n-button--primary-type {
  box-shadow: 0 2px 6px rgba(91, 156, 246, 0.2) !important;
}

:root.dark .n-button--primary-type:hover {
  box-shadow: 0 4px 12px rgba(91, 156, 246, 0.3) !important;
}

:root.dark .n-input:focus-within {
  box-shadow: 0 0 0 3px rgba(91, 156, 246, 0.12) !important;
}

:root.dark .n-card {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25) !important;
}

:root.dark .n-card:hover {
  box-shadow: 0 4px 12px rgba(91, 156, 246, 0.1) !important;
}

:root.dark .n-modal {
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4) !important;
}
</style>
