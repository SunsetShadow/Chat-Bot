import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useThemeStore, type ThemeMode } from "../theme";

describe("Theme Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    // 清除 localStorage
    localStorage.clear();
    // 重置 document.documentElement class
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("初始状态", () => {
    it("默认模式应为 'system'", () => {
      const store = useThemeStore();
      expect(store.mode).toBe("system");
    });

    it("resolvedMode 初始应为 'light'（假设系统偏好为亮色）", () => {
      const store = useThemeStore();
      expect(store.resolvedMode).toBe("light");
    });
  });

  describe("setMode 方法", () => {
    it("切换到 'dark' 模式应更新 mode 和 resolvedMode", () => {
      const store = useThemeStore();

      store.setMode("dark");

      expect(store.mode).toBe("dark");
      expect(store.resolvedMode).toBe("dark");
    });

    it("切换到 'light' 模式应更新 mode 和 resolvedMode", () => {
      const store = useThemeStore();

      store.setMode("light");

      expect(store.mode).toBe("light");
      expect(store.resolvedMode).toBe("light");
    });

    it("切换到 'system' 模式应使用系统偏好", () => {
      const store = useThemeStore();
      // 模拟系统暗色偏好
      vi.spyOn(window, "matchMedia").mockReturnValue({
        matches: true,
        media: "(prefers-color-scheme: dark)",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as MediaQueryList);

      store.setMode("system");

      expect(store.mode).toBe("system");
      expect(store.resolvedMode).toBe("dark");
    });

    it("应将选择保存到 localStorage", () => {
      const store = useThemeStore();

      store.setMode("dark");

      expect(localStorage.getItem("theme-mode")).toBe("dark");
    });
  });

  describe("applyTheme 方法（通过 setMode 测试）", () => {
    it("切换到暗色模式应添加 'dark' class 到 html 元素", () => {
      const store = useThemeStore();

      store.setMode("dark");

      expect(document.documentElement.classList.contains("dark")).toBe(true);
    });

    it("切换到亮色模式应移除 'dark' class", () => {
      const store = useThemeStore();
      document.documentElement.classList.add("dark");

      store.setMode("light");

      expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
  });

  describe("init 方法", () => {
    it("应从 localStorage 恢复保存的主题", () => {
      localStorage.setItem("theme-mode", "dark");

      const store = useThemeStore();
      store.init();

      expect(store.mode).toBe("dark");
      expect(store.resolvedMode).toBe("dark");
    });

    it("localStorage 为空时应使用默认值 'system'", () => {
      const store = useThemeStore();
      store.init();

      expect(store.mode).toBe("system");
    });

    it("应监听系统主题变化", () => {
      // 模拟 matchMedia 返回的对象
      const mockAddEventListener = vi.fn();
      vi.spyOn(window, "matchMedia").mockReturnValue({
        matches: false,
        media: "(prefers-color-scheme: dark)",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: mockAddEventListener,
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      } as unknown as MediaQueryList);

      const store = useThemeStore();
      store.init();

      expect(mockAddEventListener).toHaveBeenCalledWith(
        "change",
        expect.any(Function)
      );
    });
  });
});
