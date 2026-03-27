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

// 暗色赛博朋克主题配置
const darkThemeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: "#00f0ff",
    primaryColorHover: "#33f3ff",
    primaryColorPressed: "#00c4cc",
    primaryColorSuppl: "#00f0ff",

    fontFamily: "Sora, sans-serif",
    fontFamilyMono: "JetBrains Mono, monospace",

    borderRadius: "10px",
    borderRadiusSmall: "6px",

    textColorBase: "#e2e8f0",
    textColor1: "#e2e8f0",
    textColor2: "#94a3b8",
    textColor3: "#64748b",
    textColorDisabled: "#475569",

    placeholderColor: "#64748b",
    placeholderColorDisabled: "#475569",

    boxShadow1: "0 2px 4px rgba(0, 0, 0, 0.4)",
    boxShadow2: "0 4px 8px rgba(0, 0, 0, 0.5)",
    boxShadow3: "0 8px 16px rgba(0, 0, 0, 0.6)",

    borderColor: "rgba(191, 90, 242, 0.2)",
    dividerColor: "rgba(191, 90, 242, 0.15)",
  },
  Card: {
    color: "#12121a",
    colorModal: "#12121a",
    borderColor: "rgba(191, 90, 242, 0.2)",
    titleTextColor: "#e2e8f0",
    textColor: "#94a3b8",
    borderRadius: "16px",
  },
  Button: {
    textColorPrimary: "#0a0a0f",
    textColorHoverPrimary: "#0a0a0f",
    textColorPressedPrimary: "#0a0a0f",
    colorPrimary: "#00f0ff",
    colorHoverPrimary: "#33f3ff",
    colorPressedPrimary: "#00c4cc",
    borderRadiusMedium: "8px",
    fontWeight: "500",
  },
  Input: {
    color: "#1a1a25",
    colorFocus: "#1a1a25",
    borderColor: "rgba(191, 90, 242, 0.2)",
    borderColorHover: "rgba(191, 90, 242, 0.4)",
    borderColorFocus: "#00f0ff",
    boxShadowFocus: "0 0 0 3px rgba(0, 240, 255, 0.15)",
    textColor: "#e2e8f0",
    caretColor: "#00f0ff",
    borderRadius: "10px",
  },
  Select: {
    peers: {
      InternalSelection: {
        textColor: "#e2e8f0",
        color: "#1a1a25",
        colorActive: "#1a1a25",
        border: "1px solid rgba(191, 90, 242, 0.2)",
        borderHover: "1px solid rgba(191, 90, 242, 0.4)",
        borderActive: "1px solid #00f0ff",
        boxShadowActive: "0 0 0 3px rgba(0, 240, 255, 0.15)",
        borderRadius: "10px",
      },
      InternalSelectMenu: {
        color: "#12121a",
        optionTextColor: "#e2e8f0",
        optionTextColorActive: "#00f0ff",
        borderRadius: "10px",
      },
    },
  },
  Modal: {
    color: "#12121a",
    borderRadius: "16px",
  },
  Tabs: {
    tabTextColorLine: "#94a3b8",
    tabTextColorActiveLine: "#00f0ff",
    tabTextColorHoverLine: "#00f0ff",
    barColor: "#00f0ff",
    tabBorderColor: "rgba(191, 90, 242, 0.2)",
  },
  Tag: {
    borderRadius: "6px",
  },
  Switch: {
    railColorActive: "#00f0ff",
  },
  Scrollbar: {
    color: "rgba(191, 90, 242, 0.3)",
  },
  Message: {
    textColor: "#e2e8f0",
  },
  Dialog: {
    textColor: "#e2e8f0",
    titleTextColor: "#e2e8f0",
  },
};

const currentTheme = computed(() =>
  themeStore.resolvedMode === "dark" ? darkTheme : null
);

const currentThemeOverrides = computed(() =>
  themeStore.resolvedMode === "dark" ? darkThemeOverrides : lightThemeOverrides
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
  box-shadow: 0 2px 8px rgba(0, 240, 255, 0.25) !important;
}

:root.dark .n-button--primary-type:hover {
  box-shadow: 0 4px 16px rgba(0, 240, 255, 0.4) !important;
}

:root.dark .n-input:focus-within {
  box-shadow: 0 0 0 3px rgba(0, 240, 255, 0.15) !important;
}

:root.dark .n-card {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4) !important;
}

:root.dark .n-card:hover {
  box-shadow: 0 4px 16px rgba(0, 240, 255, 0.15) !important;
}

:root.dark .n-modal {
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6) !important;
}
</style>
