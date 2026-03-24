<script setup lang="ts">
import {
  NConfigProvider,
  NMessageProvider,
  NDialogProvider,
  NNotificationProvider,
  zhCN,
  dateZhCN,
  type GlobalThemeOverrides,
} from "naive-ui";

// 清新主题配置
const themeOverrides: GlobalThemeOverrides = {
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
</script>

<template>
  <NConfigProvider
    :locale="zhCN"
    :date-locale="dateZhCN"
    :theme-overrides="themeOverrides"
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
/* Naive UI Overrides - Fresh Theme */
.n-button--primary-type {
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.2) !important;
}

.n-button--primary-type:hover {
  box-shadow: 0 4px 8px rgba(59, 130, 246, 0.3) !important;
}

.n-input:focus-within {
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1) !important;
}

.n-card {
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1) !important;
}

.n-card:hover {
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.15) !important;
}

.n-modal {
  box-shadow: 0 20px 25px rgba(0, 0, 0, 0.15) !important;
}
</style>
