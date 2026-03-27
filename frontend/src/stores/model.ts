import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { get } from "@/api/request";

export interface Model {
  id: string;
  name: string;
  provider: string;
  available: boolean;
  context_length?: number;
  description?: string;
}

const STORAGE_KEY = "default-model";

export const useModelStore = defineStore("model", () => {
  // State
  const models = ref<Model[]>([]);
  const defaultModel = ref<string | null>(null);
  const sessionModels = ref<Record<string, string>>({});
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // Computed
  const availableModels = computed(() =>
    models.value.filter((m) => m.available),
  );

  // Actions
  async function fetchModels() {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await get<{ models: Model[] }>("/models");
      models.value = response.models;

      // Load saved preferences
      const savedDefault = localStorage.getItem(STORAGE_KEY);
      if (savedDefault && models.value.some((m) => m.id === savedDefault)) {
        defaultModel.value = savedDefault;
      } else if (models.value.length > 0) {
        // Set first available model as default
        defaultModel.value = models.value[0].id;
      }

      return models.value;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "获取模型列表失败";
      // Fallback to default models if API fails
      models.value = getFallbackModels();
      defaultModel.value = models.value[0]?.id || null;
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  function setDefaultModel(modelId: string) {
    if (models.value.some((m) => m.id === modelId)) {
      defaultModel.value = modelId;
      localStorage.setItem(STORAGE_KEY, modelId);
    }
  }

  function getSessionModel(sessionId: string): string | null {
    return sessionModels.value[sessionId] || null;
  }

  function setSessionModel(sessionId: string, modelId: string) {
    if (models.value.some((m) => m.id === modelId)) {
      sessionModels.value[sessionId] = modelId;
    }
  }

  function getModelById(modelId: string): Model | undefined {
    return models.value.find((m) => m.id === modelId);
  }

  function getEffectiveModel(sessionId?: string): string | null {
    if (sessionId && sessionModels.value[sessionId]) {
      return sessionModels.value[sessionId];
    }
    return defaultModel.value;
  }

  // Fallback models if API is not available
  function getFallbackModels(): Model[] {
    return [
      {
        id: "gpt-4o",
        name: "GPT-4o",
        provider: "openai",
        available: true,
        context_length: 128000,
        description: "最新多模态模型，速度快且智能",
      },
      {
        id: "gpt-4o-mini",
        name: "GPT-4o Mini",
        provider: "openai",
        available: true,
        context_length: 128000,
        description: "轻量级模型，适合日常对话",
      },
      {
        id: "gpt-4-turbo",
        name: "GPT-4 Turbo",
        provider: "openai",
        available: true,
        context_length: 128000,
        description: "高性能推理模型",
      },
      {
        id: "gpt-3.5-turbo",
        name: "GPT-3.5 Turbo",
        provider: "openai",
        available: true,
        context_length: 16385,
        description: "经济高效的选择",
      },
      {
        id: "claude-3-5-sonnet",
        name: "Claude 3.5 Sonnet",
        provider: "anthropic",
        available: true,
        context_length: 200000,
        description: "Anthropic 最新模型",
      },
      {
        id: "claude-3-opus",
        name: "Claude 3 Opus",
        provider: "anthropic",
        available: true,
        context_length: 200000,
        description: "最强推理能力",
      },
      {
        id: "gemini-1.5-pro",
        name: "Gemini 1.5 Pro",
        provider: "google",
        available: true,
        context_length: 1000000,
        description: "Google 超长上下文模型",
      },
    ];
  }

  return {
    // State
    models,
    defaultModel,
    sessionModels,
    isLoading,
    error,

    // Computed
    availableModels,

    // Actions
    fetchModels,
    setDefaultModel,
    getSessionModel,
    setSessionModel,
    getModelById,
    getEffectiveModel,
  };
});
