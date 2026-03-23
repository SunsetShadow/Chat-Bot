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
  // 状态
  const rules = ref<Rule[]>([]);
  const enabledRuleIds = ref<Set<string>>(new Set());
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  // 计算属性
  const enabledRules = computed(() =>
    rules.value.filter((r) => enabledRuleIds.value.has(r.id)),
  );
  const builtinRules = computed(() => rules.value.filter((r) => r.is_builtin));
  const customRules = computed(() => rules.value.filter((r) => !r.is_builtin));

  // 方法
  async function fetchRules() {
    isLoading.value = true;
    error.value = null;
    try {
      rules.value = await apiGetRules();
      // 初始化启用的规则（从规则自身的 enabled 状态）
      enabledRuleIds.value = new Set(
        rules.value.filter((r) => r.enabled).map((r) => r.id),
      );
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
    if (!rule) return;

    const newEnabled = !enabledRuleIds.value.has(id);
    await updateRule(id, { enabled: newEnabled });

    if (newEnabled) {
      enabledRuleIds.value.add(id);
    } else {
      enabledRuleIds.value.delete(id);
    }
  }

  function enableRule(id: string) {
    if (rules.value.find((r) => r.id === id)) {
      enabledRuleIds.value.add(id);
    }
  }

  function disableRule(id: string) {
    enabledRuleIds.value.delete(id);
  }

  function clearError() {
    error.value = null;
  }

  return {
    // 状态
    rules,
    enabledRuleIds,
    isLoading,
    error,
    // 计算属性
    enabledRules,
    builtinRules,
    customRules,
    // 方法
    fetchRules,
    createRule,
    updateRule,
    deleteRule,
    toggleRule,
    enableRule,
    disableRule,
    clearError,
  };
});
