import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { Agent, AgentCreate, AgentUpdate } from "@/types";
import {
  getAgents as apiGetAgents,
  createAgent as apiCreateAgent,
  updateAgent as apiUpdateAgent,
  deleteAgent as apiDeleteAgent,
} from "@/api/chat";
import { useRulesStore } from "./rules";

export const useAgentStore = defineStore("agent", () => {
  const agents = ref<Agent[]>([]);
  const currentAgentId = ref<string | null>("ani");
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const currentAgent = computed(() =>
    agents.value.find((a) => a.id === currentAgentId.value),
  );
  const builtinAgents = computed(() =>
    agents.value.filter((a) => a.is_builtin),
  );
  const customAgents = computed(() =>
    agents.value.filter((a) => !a.is_builtin),
  );

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
        currentAgentId.value = "ani";
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : "删除 Agent 失败";
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  /** 保存当前 general 规则到指定 Agent */
  async function saveCurrentRulesToAgent(agentId?: string) {
    const targetId = agentId || currentAgentId.value;
    if (!targetId) return;

    const rulesStore = useRulesStore();
    const ruleIds = rulesStore.getCurrentGeneralRuleIds();
    const agent = agents.value.find((a) => a.id === targetId);
    if (!agent) return;

    const prevIds = JSON.stringify(agent.rule_ids || []);
    const nextIds = JSON.stringify(ruleIds);
    if (prevIds === nextIds) return;

    try {
      const updated = await apiUpdateAgent(targetId, { rule_ids: ruleIds } as AgentUpdate);
      const index = agents.value.findIndex((a) => a.id === targetId);
      if (index !== -1) agents.value[index] = updated;
    } catch (e) {
      console.warn(`[AgentStore] 保存规则到 Agent ${targetId} 失败:`, e);
    }
  }

  function setCurrentAgent(agentId: string) {
    currentAgentId.value = agentId;

    // 恢复该 Agent 的规则配置
    const rulesStore = useRulesStore();
    const agent = agents.value.find((a) => a.id === agentId);
    if (agent) {
      rulesStore.setAgentRules(agent.rule_ids || []);
    }
  }

  function clearError() {
    error.value = null;
  }

  return {
    agents,
    currentAgentId,
    isLoading,
    error,
    currentAgent,
    builtinAgents,
    customAgents,
    fetchAgents,
    createAgent,
    updateAgent,
    deleteAgent,
    saveCurrentRulesToAgent,
    setCurrentAgent,
    clearError,
  };
});
