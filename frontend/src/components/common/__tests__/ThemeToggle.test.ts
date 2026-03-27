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

  it("应正确渲染组件", () => {
    const wrapper = mount(ThemeToggle);

    // 组件应包含按钮元素
    expect(wrapper.find("button").exists()).toBe(true);
  });

  it("亮色模式下 store.resolvedMode 应为 light", () => {
    const store = useThemeStore();
    store.setMode("light");

    mount(ThemeToggle);

    expect(store.resolvedMode).toBe("light");
  });

  it("暗色模式下 store.resolvedMode 应为 dark", () => {
    const store = useThemeStore();
    store.setMode("dark");

    mount(ThemeToggle);

    expect(store.resolvedMode).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("应包含三个主题选项", () => {
    const wrapper = mount(ThemeToggle);

    // 检查 options 数据
    const options = wrapper.vm.options;
    expect(options).toHaveLength(3);
    expect(options.map((o: { value: string }) => o.value)).toContain("light");
    expect(options.map((o: { value: string }) => o.value)).toContain("dark");
    expect(options.map((o: { value: string }) => o.value)).toContain("system");
  });

  it("handleSelect 应调用 store.setMode", () => {
    const store = useThemeStore();
    const spy = vi.spyOn(store, "setMode");

    const wrapper = mount(ThemeToggle);
    wrapper.vm.handleSelect("dark");

    expect(spy).toHaveBeenCalledWith("dark");
  });

  it("系统模式下 currentIcon 应返回 DesktopOutline", () => {
    const store = useThemeStore();
    store.setMode("system");

    const wrapper = mount(ThemeToggle);

    expect(wrapper.vm.currentIcon.name).toBe("DesktopOutline");
  });
});
