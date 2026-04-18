import { defineStore } from "pinia";
import { ref, computed } from "vue";
import type { Rule, RuleCreate, RuleUpdate } from "@/types";
import {
  getRules as apiGetRules,
  createRule as apiCreateRule,
  updateRule as apiUpdateRule,
  deleteRule as apiDeleteRule,
} from "@/api/chat";

export const useRulesStore = defineStore("rules", () => {
  const rules = ref<Rule[]>([]);
  const enabledRuleIds = ref<Set<string>>(new Set());
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const enabledRules = computed(() =>
    rules.value.filter((r) => enabledRuleIds.value.has(r.id)),
  );
  const globalRules = computed(() =>
    rules.value.filter((r) => r.scope === "global"),
  );
  const generalRules = computed(() =>
    rules.value.filter((r) => r.scope === "general"),
  );
  const builtinRules = computed(() => rules.value.filter((r) => r.is_builtin));
  const customRules = computed(() => rules.value.filter((r) => !r.is_builtin));

  async function fetchRules() {
    isLoading.value = true;
    error.value = null;
    try {
      rules.value = await apiGetRules();
      const enabled = new Set<string>();
      // global 规则强制启用
      for (const r of rules.value) {
        if (r.scope === "global" && r.enabled) enabled.add(r.id);
      }
      // general 规则按自身 enabled 状态
      for (const r of rules.value) {
        if (r.scope === "general" && r.enabled) enabled.add(r.id);
      }
      enabledRuleIds.value = enabled;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "获取规则列表失败";
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function createRule(data: RuleCreate) {
    isLoading.value = true;
    error.value = null;
    try {
      const rule = await apiCreateRule(data);
      rules.value.push(rule);
      if (rule.scope === "global") {
        enabledRuleIds.value.add(rule.id);
      }
      return rule;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "创建规则失败";
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function updateRule(id: string, data: RuleUpdate) {
    isLoading.value = true;
    error.value = null;
    try {
      const rule = await apiUpdateRule(id, data);
      const index = rules.value.findIndex((r) => r.id === id);
      if (index !== -1) {
        rules.value[index] = rule;
      }
      return rule;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "更新规则失败";
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function deleteRule(id: string) {
    isLoading.value = true;
    error.value = null;
    try {
      await apiDeleteRule(id);
      rules.value = rules.value.filter((r) => r.id !== id);
      enabledRuleIds.value.delete(id);
    } catch (e) {
      error.value = e instanceof Error ? e.message : "删除规则失败";
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  async function toggleRule(id: string) {
    const rule = rules.value.find((r) => r.id === id);
    if (!rule || rule.scope === "global") return;

    const newEnabled = !enabledRuleIds.value.has(id);
    await updateRule(id, { enabled: newEnabled });

    if (newEnabled) {
      enabledRuleIds.value.add(id);
    } else {
      enabledRuleIds.value.delete(id);
    }
  }

  /** 切换 Agent 时调用：设置 general 规则的启用状态 */
  function setAgentRules(ruleIds: string[] = []) {
    const newEnabled = new Set<string>();
    // global 规则始终启用
    for (const r of rules.value) {
      if (r.scope === "global" && r.enabled) newEnabled.add(r.id);
    }
    // 设置该 Agent 启用的 general 规则
    for (const id of ruleIds) {
      if (rules.value.some((r) => r.id === id && r.scope === "general")) {
        newEnabled.add(id);
      }
    }
    enabledRuleIds.value = newEnabled;
  }

  /** 获取当前 Agent 启用的 general 规则 ID 列表（用于保存到 Agent） */
  function getCurrentGeneralRuleIds(): string[] {
    return generalRules.value
      .filter((r) => enabledRuleIds.value.has(r.id))
      .map((r) => r.id);
  }

  function clearError() {
    error.value = null;
  }

  return {
    rules,
    enabledRuleIds,
    isLoading,
    error,
    enabledRules,
    globalRules,
    generalRules,
    builtinRules,
    customRules,
    fetchRules,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
    setAgentRules,
    getCurrentGeneralRuleIds,
    clearError,
  };
});
