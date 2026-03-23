<script setup lang="ts">
import {
  NConfigProvider,
  NMessageProvider,
  NDialogProvider,
  NNotificationProvider,
  zhCN,
  dateZhCN,
  type GlobalThemeOverrides,
  darkTheme,
} from "naive-ui";

// 自定义主题
const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: "#00f5d4",
    primaryColorHover: "#00c4aa",
    primaryColorPressed: "#00a088",
    primaryColorSuppl: "#00d4b8",

    fontFamily: "Sora, sans-serif",
    fontFamilyMono: "JetBrains Mono, monospace",

    borderRadius: "12px",
    borderRadiusSmall: "8px",

    textColorBase: "#e8e8ed",
    textColor1: "#e8e8ed",
    textColor2: "#9898a8",
    textColor3: "#5a5a6e",
    textColorDisabled: "#3a3a4e",

    placeholderColor: "#5a5a6e",
    placeholderColorDisabled: "#3a3a4e",

    boxShadow1: "0 2px 8px rgba(0, 0, 0, 0.3)",
    boxShadow2: "0 4px 20px rgba(0, 0, 0, 0.4)",
    boxShadow3: "0 8px 40px rgba(0, 0, 0, 0.5)",
  },
  Card: {
    color: "rgba(18, 18, 26, 0.7)",
    colorModal: "rgba(18, 18, 26, 0.9)",
    borderColor: "rgba(255, 255, 255, 0.06)",
    titleTextColor: "#e8e8ed",
    textColor: "#9898a8",
    borderRadius: "20px",
  },
  Button: {
    textColorPrimary: "#0a0a0f",
    textColorHoverPrimary: "#0a0a0f",
    textColorPressedPrimary: "#0a0a0f",
    colorPrimary: "#00f5d4",
    colorHoverPrimary: "#00d4b8",
    colorPressedPrimary: "#00c4aa",
    borderRadiusMedium: "8px",
    fontWeight: "500",
  },
  Input: {
    color: "rgba(26, 26, 37, 0.8)",
    colorFocus: "rgba(26, 26, 37, 0.9)",
    borderColor: "rgba(255, 255, 255, 0.06)",
    borderColorHover: "rgba(0, 245, 212, 0.3)",
    borderColorFocus: "#00f5d4",
    boxShadowFocus: "0 0 0 2px rgba(0, 245, 212, 0.2)",
    textColor: "#e8e8ed",
    caretColor: "#00f5d4",
    borderRadius: "12px",
  },
  Select: {
    peers: {
      InternalSelection: {
        textColor: "#e8e8ed",
        color: "rgba(26, 26, 37, 0.8)",
        colorActive: "rgba(26, 26, 37, 0.9)",
        border: "1px solid rgba(255, 255, 255, 0.06)",
        borderHover: "1px solid rgba(0, 245, 212, 0.3)",
        borderActive: "1px solid #00f5d4",
        boxShadowActive: "0 0 0 2px rgba(0, 245, 212, 0.2)",
        borderRadius: "12px",
      },
      InternalSelectMenu: {
        color: "rgba(18, 18, 26, 0.95)",
        optionTextColor: "#e8e8ed",
        optionTextColorActive: "#00f5d4",
        borderRadius: "12px",
      },
    },
  },
  Modal: {
    color: "rgba(18, 18, 26, 0.95)",
    borderRadius: "20px",
  },
  Tabs: {
    tabTextColorLine: "#9898a8",
    tabTextColorActiveLine: "#00f5d4",
    tabTextColorHoverLine: "#00f5d4",
    barColor: "#00f5d4",
    tabBorderColor: "rgba(255, 255, 255, 0.06)",
  },
  Tag: {
    borderRadius: "6px",
  },
  Switch: {
    railColorActive: "#00f5d4",
  },
  Scrollbar: {
    color: "rgba(0, 245, 212, 0.3)",
  },
};
</script>

<template>
  <NConfigProvider
    :theme="darkTheme"
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
/* Naive UI Overrides */
.n-button--primary-type {
  box-shadow: 0 0 20px rgba(0, 245, 212, 0.3) !important;
}

.n-input:hover,
.n-input:focus-within {
  box-shadow: 0 0 20px rgba(0, 245, 212, 0.1) !important;
}

.n-card {
  backdrop-filter: blur(20px) !important;
}

.n-modal {
  backdrop-filter: blur(20px) !important;
}
</style>
