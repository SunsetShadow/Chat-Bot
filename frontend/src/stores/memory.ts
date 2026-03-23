import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { Memory, MemoryCreate, MemoryType } from "@/types";
import {
  getMemories as apiGetMemories,
  createMemory as apiCreateMemory,
  deleteMemory as apiDeleteMemory,
} from "@/api/chat";

export const useMemoryStore = defineStore("memory", () => {
  // 状态
  const memories = ref<Memory[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // 计算属性
  const factMemories = computed(() =>
    memories.value.filter((m) => m.type === "fact"),
  );
  const preferenceMemories = computed(() =>
    memories.value.filter((m) => m.type === "preference"),
  );
  const eventMemories = computed(() =>
    memories.value.filter((m) => m.type === "event"),
  );
  const importantMemories = computed(() =>
    memories.value.filter((m) => m.importance >= 7),
  );

  // 方法
  async function fetchMemories(type?: MemoryType, minImportance = 1) {
    isLoading.value = true;
    error.value = null;
    try {
      memories.value = await apiGetMemories(type, minImportance);
    } catch (e) {
      error.value = e instanceof Error ? e.message : "获取记忆列表失败";
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function createMemory(data: MemoryCreate) {
    isLoading.value = true;
    error.value = null;
    try {
      const memory = await apiCreateMemory(data);
      memories.value.unshift(memory);
      return memory;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "创建记忆失败";
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteMemory(id: string) {
    isLoading.value = true;
    error.value = null;
    try {
      await apiDeleteMemory(id);
      memories.value = memories.value.filter((m) => m.id !== id);
    } catch (e) {
      error.value = e instanceof Error ? e.message : "删除记忆失败";
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  function clearError() {
    error.value = null;
  }

  return {
    // 状态
    memories,
    isLoading,
    error,
    // 计算属性
    factMemories,
    preferenceMemories,
    eventMemories,
    importantMemories,
    // 方法
    fetchMemories,
    createMemory,
    deleteMemory,
    clearError,
  };
});
