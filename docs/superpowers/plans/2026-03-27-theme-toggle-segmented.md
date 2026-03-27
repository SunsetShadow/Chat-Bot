# Theme Toggle Segmented Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将主题切换从下拉菜单改为分段控制器，三个主题选项直接显示在顶部

**Architecture:** 修改 ThemeToggle.vue，使用 NButtonGroup + NButton 替换 NDropdown，保持 theme.ts store 不变

**Tech Stack:** Vue 3, Naive UI, Vitest, TypeScript

---

## File Structure

| 文件 | 变更 | 说明 |
|------|------|------|
| `frontend/src/components/common/ThemeToggle.vue` | 修改 | 下拉菜单改为分段控制器 |
| `frontend/src/components/common/__tests__/ThemeToggle.test.ts` | 修改 | 更新测试用例 |

---

## Task 1: 更新测试用例

**Files:**
- Modify: `frontend/src/components/common/__tests__/ThemeToggle.test.ts`

- [ ] **Step 1: 重写测试文件**

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { mount } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import ThemeToggle from "../ThemeToggle.vue";
import { useThemeStore } from "@/stores/theme";

describe("ThemeToggle 组件", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("应渲染三个主题按钮", () => {
    const wrapper = mount(ThemeToggle);
    const buttons = wrapper.findAll("button");
    expect(buttons).toHaveLength(3);
  });

  it("按钮标签应包含亮色、暗色、系统", () => {
    const wrapper = mount(ThemeToggle);
    const text = wrapper.text();
    expect(text).toContain("亮色");
    expect(text).toContain("暗色");
    expect(text).toContain("系统");
  });

  it("点击暗色按钮应切换到暗色模式", async () => {
    const store = useThemeStore();
    const spy = vi.spyOn(store, "setMode");

    const wrapper = mount(ThemeToggle);
    const buttons = wrapper.findAll("button");
    await buttons[1].trigger("click");

    expect(spy).toHaveBeenCalledWith("dark");
  });

  it("点击亮色按钮应切换到亮色模式", async () => {
    const store = useThemeStore();
    const spy = vi.spyOn(store, "setMode");

    const wrapper = mount(ThemeToggle);
    const buttons = wrapper.findAll("button");
    await buttons[0].trigger("click");

    expect(spy).toHaveBeenCalledWith("light");
  });

  it("点击系统按钮应切换到系统模式", async () => {
    const store = useThemeStore();
    const spy = vi.spyOn(store, "setMode");

    const wrapper = mount(ThemeToggle);
    const buttons = wrapper.findAll("button");
    await buttons[2].trigger("click");

    expect(spy).toHaveBeenCalledWith("system");
  });

  it("暗色模式下 store.resolvedMode 应为 dark", () => {
    const store = useThemeStore();
    store.setMode("dark");

    mount(ThemeToggle);

    expect(store.resolvedMode).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("亮色模式下 store.resolvedMode 应为 light", () => {
    const store = useThemeStore();
    store.setMode("light");

    mount(ThemeToggle);

    expect(store.resolvedMode).toBe("light");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && pnpm test components/common/__tests__/ThemeToggle.test.ts`

Expected: 测试失败（因为组件仍使用下拉菜单，只有 1 个按钮）

---

## Task 2: 实现分段控制器

**Files:**
- Modify: `frontend/src/components/common/ThemeToggle.vue`

- [ ] **Step 1: 重写组件为分段控制器**

```vue
<script setup lang="ts">
import { computed } from "vue";
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
```

- [ ] **Step 2: 运行测试确认通过**

Run: `cd frontend && pnpm test components/common/__tests__/ThemeToggle.test.ts`

Expected: 所有测试通过

- [ ] **Step 3: 运行 lint 检查**

Run: `cd frontend && pnpm lint`

Expected: 无错误

- [ ] **Step 4: 提交变更**

```bash
git add frontend/src/components/common/ThemeToggle.vue frontend/src/components/common/__tests__/ThemeToggle.test.ts
git commit -m "feat(theme): change theme toggle from dropdown to segmented control

- Replace NDropdown with NButtonGroup for direct theme selection
- Add icon + text labels for better UX
- Update unit tests for new component structure"
```

---

## Task 3: 浏览器验证

**Files:** 无文件变更，仅验证

- [ ] **Step 1: 启动开发服务器**

Run: `cd /Users/reeves/Downloads/workspace/Chat-Bot && ./dev.sh`

- [ ] **Step 2: 在浏览器中验证**

打开 http://localhost:3000，检查：
1. 顶部显示三个主题按钮（亮色、暗色、系统）
2. 点击按钮立即切换主题
3. 当前选中项高亮显示
4. 亮色/暗色模式下样式正常

---

## Self-Review

**1. Spec coverage:**
- [x] 三个主题按钮直接显示 - Task 2
- [x] 点击按钮立即切换主题 - Task 2
- [x] 当前选中项高亮 - Task 2
- [x] 亮色/暗色模式正常 - Task 3
- [x] 单元测试通过 - Task 2

**2. Placeholder scan:** 无 TBD/TODO

**3. Type consistency:** ThemeMode 类型一致
