import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { Agent, AgentCreate, AgentUpdate } from "@/types";
import {
  getAgents as apiGetAgents,
  createAgent as apiCreateAgent,
  updateAgent as apiUpdateAgent,
  deleteAgent as apiDeleteAgent,
} from "@/api/chat";

export const useAgentStore = defineStore("agent", () => {
  // 状态
  const agents = ref<Agent[]>([]);
  const currentAgentId = ref<string | null>("builtin-general");
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // 计算属性
  const currentAgent = computed(() =>
    agents.value.find((a) => a.id === currentAgentId.value),
  );
  const builtinAgents = computed(() =>
    agents.value.filter((a) => a.is_builtin),
  );
  const customAgents = computed(() =>
    agents.value.filter((a) => !a.is_builtin),
  );

  // 方法
  async function fetchAgents() {
    isLoading.value = true;
    error.value = null;
    try {
      agents.value = await apiGetAgents();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "获取 Agent 列表失败";
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function createAgent(data: AgentCreate) {
    isLoading.value = true;
    error.value = null;
    try {
      const agent = await apiCreateAgent(data);
      agents.value.push(agent);
      return agent;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "创建 Agent 失败";
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function updateAgent(id: string, data: AgentUpdate) {
    isLoading.value = true;
    error.value = null;
    try {
      const agent = await apiUpdateAgent(id, data);
      const index = agents.value.findIndex((a) => a.id === id);
      if (index !== -1) {
        agents.value[index] = agent;
      }
      return agent;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "更新 Agent 失败";
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteAgent(id: string) {
    isLoading.value = true;
    error.value = null;
    try {
      await apiDeleteAgent(id);
      agents.value = agents.value.filter((a) => a.id !== id);
      if (currentAgentId.value === id) {
        currentAgentId.value = "builtin-general";
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : "删除 Agent 失败";
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  function setCurrentAgent(agentId: string) {
    currentAgentId.value = agentId;
  }

  function clearError() {
    error.value = null;
  }

  return {
    // 状态
    agents,
    currentAgentId,
    isLoading,
    error,
    // 计算属性
    currentAgent,
    builtinAgents,
    customAgents,
    // 方法
    fetchAgents,
    createAgent,
    updateAgent,
    deleteAgent,
    setCurrentAgent,
    clearError,
  };
});
