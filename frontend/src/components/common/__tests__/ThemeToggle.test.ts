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
