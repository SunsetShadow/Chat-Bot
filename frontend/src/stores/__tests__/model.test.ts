import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useModelStore } from "../model";

// Mock the API request module
vi.mock("@/api/request", () => ({
  get: vi.fn(),
}));

import { get } from "@/api/request";

describe("Model Store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("初始状态", () => {
    it("models 应为空数组", () => {
      const store = useModelStore();
      expect(store.models).toEqual([]);
    });

    it("defaultModel 应为 null", () => {
      const store = useModelStore();
      expect(store.defaultModel).toBeNull();
    });

    it("isLoading 应为 false", () => {
      const store = useModelStore();
      expect(store.isLoading).toBe(false);
    });
  });

  describe("fetchModels 方法", () => {
    it("成功获取模型列表", async () => {
      const mockModels = [
        {
          id: "gpt-4o",
          name: "GPT-4o",
          provider: "openai",
          available: true,
          context_length: 128000,
        },
        {
          id: "claude-3-5-sonnet",
          name: "Claude 3.5 Sonnet",
          provider: "anthropic",
          available: true,
          context_length: 200000,
        },
      ];

      vi.mocked(get).mockResolvedValueOnce({ models: mockModels });

      const store = useModelStore();
      await store.fetchModels();

      expect(store.models).toEqual(mockModels);
      expect(store.models.length).toBe(2);
    });

    it("获取模型列表后设置默认模型", async () => {
      const mockModels = [
        { id: "gpt-4o", name: "GPT-4o", provider: "openai", available: true },
      ];

      vi.mocked(get).mockResolvedValueOnce({ models: mockModels });

      const store = useModelStore();
      await store.fetchModels();

      expect(store.defaultModel).toBe("gpt-4o");
    });

    it("API 失败时使用备用模型列表", async () => {
      vi.mocked(get).mockRejectedValueOnce(new Error("Network error"));

      const store = useModelStore();

      try {
        await store.fetchModels();
      } catch {
        // 预期会抛出错误
      }

      // 备用模型列表应被使用
      expect(store.models.length).toBeGreaterThan(0);
      expect(store.models[0].id).toBeDefined();
    });
  });

  describe("setDefaultModel 方法", () => {
    it("应更新 defaultModel 并保存到 localStorage", async () => {
      const mockModels = [
        { id: "gpt-4o", name: "GPT-4o", provider: "openai", available: true },
        {
          id: "claude-3-5-sonnet",
          name: "Claude",
          provider: "anthropic",
          available: true,
        },
      ];

      vi.mocked(get).mockResolvedValueOnce({ models: mockModels });

      const store = useModelStore();
      await store.fetchModels();
      store.setDefaultModel("claude-3-5-sonnet");

      expect(store.defaultModel).toBe("claude-3-5-sonnet");
      expect(localStorage.getItem("default-model")).toBe("claude-3-5-sonnet");
    });

    it("无效模型 ID 不应更新 defaultModel", async () => {
      const mockModels = [
        { id: "gpt-4o", name: "GPT-4o", provider: "openai", available: true },
      ];

      vi.mocked(get).mockResolvedValueOnce({ models: mockModels });

      const store = useModelStore();
      await store.fetchModels();
      store.setDefaultModel("invalid-model");

      expect(store.defaultModel).toBe("gpt-4o");
    });
  });

  describe("会话模型管理", () => {
    beforeEach(async () => {
      const mockModels = [
        { id: "gpt-4o", name: "GPT-4o", provider: "openai", available: true },
        {
          id: "claude-3-5-sonnet",
          name: "Claude",
          provider: "anthropic",
          available: true,
        },
      ];

      vi.mocked(get).mockResolvedValueOnce({ models: mockModels });

      const store = useModelStore();
      await store.fetchModels();
    });

    it("setSessionModel 应为特定会话设置模型", () => {
      const store = useModelStore();
      store.setSessionModel("session-1", "claude-3-5-sonnet");

      expect(store.getSessionModel("session-1")).toBe("claude-3-5-sonnet");
    });

    it("getEffectiveModel 应返回会话特定模型（如果设置）", () => {
      const store = useModelStore();
      store.setDefaultModel("gpt-4o");
      store.setSessionModel("session-1", "claude-3-5-sonnet");

      expect(store.getEffectiveModel("session-1")).toBe("claude-3-5-sonnet");
    });

    it("getEffectiveModel 应返回默认模型（如果会话未设置特定模型）", () => {
      const store = useModelStore();
      store.setDefaultModel("gpt-4o");

      expect(store.getEffectiveModel("session-2")).toBe("gpt-4o");
    });
  });

  describe("getModelById 方法", () => {
    it("应返回匹配的模型", async () => {
      const mockModels = [
        { id: "gpt-4o", name: "GPT-4o", provider: "openai", available: true },
      ];

      vi.mocked(get).mockResolvedValueOnce({ models: mockModels });

      const store = useModelStore();
      await store.fetchModels();

      const model = store.getModelById("gpt-4o");
      expect(model?.name).toBe("GPT-4o");
    });

    it("模型不存在时返回 undefined", async () => {
      const mockModels = [
        { id: "gpt-4o", name: "GPT-4o", provider: "openai", available: true },
      ];

      vi.mocked(get).mockResolvedValueOnce({ models: mockModels });

      const store = useModelStore();
      await store.fetchModels();

      const model = store.getModelById("non-existent");
      expect(model).toBeUndefined();
    });
  });

  describe("availableModels 计算属性", () => {
    it("应只返回 available 为 true 的模型", async () => {
      const mockModels = [
        { id: "gpt-4o", name: "GPT-4o", provider: "openai", available: true },
        {
          id: "unavailable",
          name: "Unavailable",
          provider: "test",
          available: false,
        },
      ];

      vi.mocked(get).mockResolvedValueOnce({ models: mockModels });

      const store = useModelStore();
      await store.fetchModels();

      expect(store.availableModels.length).toBe(1);
      expect(store.availableModels[0].id).toBe("gpt-4o");
    });
  });
});
