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

const FALLBACK_MODELS: Model[] = [
  { id: "qwen3.6-plus", name: "Qwen3.6 Plus", provider: "qwen", available: true, description: "通义千问最新模型" },
  { id: "qwen3.5-plus", name: "Qwen3.5 Plus", provider: "qwen", available: true, description: "通义千问高性能模型" },
  { id: "qwen3.5-flash", name: "Qwen3.5 Flash", provider: "qwen", available: true, description: "通义千问轻量快速模型" },
  { id: "kimi-k2.5", name: "Kimi K2.5", provider: "moonshot", available: false, description: "Moonshot AI 大模型" },
  { id: "deepseek-r1", name: "DeepSeek R1", provider: "deepseek", available: false, description: "深度求索推理模型" },
  { id: "deepseek-v3", name: "DeepSeek V3", provider: "deepseek", available: false, description: "深度求索通用模型" },
  { id: "gpt-4o", name: "GPT-4o", provider: "openai", available: false, description: "OpenAI 多模态模型" },
  { id: "claude-sonnet-4", name: "Claude Sonnet 4", provider: "anthropic", available: false, description: "Anthropic 模型" },
];

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
      // 后端返回 {success, data: [...]}，models 在 data 中
      const modelArray = (response as any).models || (response as any);
      models.value = Array.isArray(modelArray) ? modelArray : [];

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

  function getFallbackModels(): Model[] {
    return FALLBACK_MODELS;
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
