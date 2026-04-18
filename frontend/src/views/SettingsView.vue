<script setup lang="ts">
import { useRouter } from "vue-router";
import AgentConfigView from "./AgentConfigView.vue";
import { useMemoryStore } from "@/stores/memory";
import { useRulesStore } from "@/stores/rules";
import { useThemeStore, type ThemeMode } from "@/stores/theme";
import { onMounted, ref, computed } from "vue";
import type { MemoryType, Rule, RuleCreate } from "@/types";
import {
  ChevronBackOutline,
  SettingsOutline,
  TrashOutline,
  CreateOutline,
  SparklesOutline,
  SunnyOutline,
  MoonOutline,
  DesktopOutline,
  AddOutline,
  OptionsOutline,
  BookmarkOutline,
} from "@vicons/ionicons5";
import SystemSettingsPane from "@/components/settings/SystemSettingsPane.vue";

const router = useRouter();
const memoryStore = useMemoryStore();
const rulesStore = useRulesStore();
const themeStore = useThemeStore();

const activeTab = ref("agents");
const memoryTab = ref<MemoryType>("preference");
const ruleTab = ref("global");

// 规则 CRUD
const showRuleModal = ref(false);
const editingRule = ref<Rule | null>(null);
const ruleForm = ref<RuleCreate>({
  name: "",
  content: "",
  category: "format",
  scope: "general",
});

const categoryOptions = [
  { label: "行为", value: "behavior" },
  { label: "格式", value: "format" },
  { label: "约束", value: "constraint" },
];

const scopeOptions = [
  { label: "通用规则", value: "general" },
  { label: "全局生效", value: "global" },
];

const categoryMap: Record<string, { label: string; color: string }> = {
  behavior: { label: "行为", color: "var(--neon-green)" },
  format: { label: "格式", color: "var(--color-primary)" },
  constraint: { label: "约束", color: "var(--neon-pink)" },
};

const memoryTabLabels: Record<string, string> = {
  preference: "偏好",
  fact: "事实",
  event: "事件",
};

const themeOptions = [
  { label: "亮色模式", value: "light" as ThemeMode },
  { label: "暗色模式", value: "dark" as ThemeMode },
  { label: "跟随系统", value: "system" as ThemeMode },
];

const ruleModalTitle = computed(() =>
  editingRule.value ? "编辑规则" : "创建规则",
);

// 当前标签页的记忆列表
const currentMemories = computed(() => {
  const typeMap: Record<string, typeof memoryStore.factMemories> = {
    preference: memoryStore.preferenceMemories,
    fact: memoryStore.factMemories,
    event: memoryStore.eventMemories,
  };
  return typeMap[memoryTab.value] || memoryStore.preferenceMemories;
});

onMounted(() => {
  memoryStore.fetchMemories();
  rulesStore.fetchRules();
});

function goBack() {
  router.push("/");
}

// Rules
function openCreateRuleModal() {
  editingRule.value = null;
  ruleForm.value = { name: "", content: "", category: "format", scope: "general" };
  showRuleModal.value = true;
}

function openEditRuleModal(rule: Rule) {
  editingRule.value = rule;
  ruleForm.value = {
    name: rule.name,
    content: rule.content,
    category: rule.category,
    scope: rule.scope,
  };
  showRuleModal.value = true;
}

async function handleRuleSubmit() {
  try {
    if (editingRule.value) {
      await rulesStore.updateRule(editingRule.value.id, ruleForm.value);
    } else {
      await rulesStore.createRule(ruleForm.value);
    }
    showRuleModal.value = false;
  } catch (error) {
    console.error("保存规则失败:", error);
  }
}

async function handleDeleteRule(id: string) {
  await rulesStore.deleteRule(id);
}

async function handleToggleRule(id: string) {
  await rulesStore.toggleRule(id);
}
</script>

<template>
  <div class="settings-view">
    <!-- Page Header -->
    <header class="page-header glass-card">
      <button class="text-back-btn" @click="goBack">
        <NIcon :component="ChevronBackOutline" :size="18" />
        <span>返回</span>
      </button>
      <div class="page-title-group">
        <div class="title-icon-wrap">
          <NIcon :component="SettingsOutline" :size="22" />
        </div>
        <div>
          <span class="title-mono">SETTINGS</span>
          <h1 class="page-title">设置中心</h1>
        </div>
      </div>
    </header>

    <!-- Content -->
    <div class="settings-content">
      <div class="tabs-wrapper glass-card">
        <NTabs v-model:value="activeTab" type="line" animated>
          <!-- Agent 管理 — 嵌入 AgentConfig -->
          <NTabPane name="agents" tab="Agent 管理">
            <div class="tab-content agent-tab-content">
              <AgentConfigView embedded />
            </div>
          </NTabPane>

          <!-- 规则管理 — 表格展示 -->
          <NTabPane name="rules" tab="规则管理">
            <div class="tab-content">
              <div class="section-header">
                <div class="section-title">
                  <div class="section-icon-wrap">
                    <NIcon :component="OptionsOutline" :size="18" />
                  </div>
                  <div>
                    <span class="title-mono">RULES</span>
                    <h3>规则配置</h3>
                  </div>
                </div>
                <button class="btn-primary btn-sm" @click="openCreateRuleModal">
                  <NIcon :component="AddOutline" :size="14" />
                  <span>创建规则</span>
                </button>
              </div>

              <NSpin :show="rulesStore.isLoading">
                <NTabs
                  v-model:value="ruleTab"
                  type="segment"
                  size="small"
                  class="rule-scope-tabs"
                >
                  <NTabPane name="global" tab="全局生效">
                    <div class="rule-scope-desc">
                      <span>所有 Agent 强制生效，不可关闭</span>
                    </div>
                    <div class="rules-table">
                      <div class="table-header">
                        <div class="col-name">名称</div>
                        <div class="col-content">内容</div>
                        <div class="col-category">类别</div>
                        <div class="col-actions">操作</div>
                      </div>
                      <div
                        v-for="(rule, index) in rulesStore.globalRules"
                        :key="rule.id"
                        class="table-row global-row"
                        :style="{ animationDelay: `${index * 0.04}s` }"
                      >
                        <div class="col-name">
                          <span class="rule-name">{{ rule.name }}</span>
                          <span class="global-tag">全局</span>
                          <span v-if="rule.is_builtin" class="builtin-tag">内置</span>
                        </div>
                        <div class="col-content" :title="rule.content">
                          {{ rule.content }}
                        </div>
                        <div class="col-category">
                          <span
                            class="category-tag"
                            :style="{
                              color: categoryMap[rule.category]?.color,
                              borderColor: categoryMap[rule.category]?.color + '40',
                              background: categoryMap[rule.category]?.color + '15',
                            }"
                          >
                            {{ categoryMap[rule.category]?.label || rule.category }}
                          </span>
                        </div>
                        <div class="col-actions">
                          <button
                            class="row-action-btn"
                            title="编辑"
                            @click="openEditRuleModal(rule)"
                          >
                            <NIcon :component="CreateOutline" :size="14" />
                          </button>
                          <button
                            v-if="!rule.is_builtin"
                            class="row-action-btn delete"
                            title="删除"
                            @click="handleDeleteRule(rule.id)"
                          >
                            <NIcon :component="TrashOutline" :size="14" />
                          </button>
                        </div>
                      </div>
                      <div
                        v-if="rulesStore.globalRules.length === 0"
                        class="table-empty"
                      >
                        <NIcon :component="OptionsOutline" :size="40" />
                        <p>暂无全局规则</p>
                        <span>创建规则时选择「全局生效」作用域</span>
                      </div>
                    </div>
                  </NTabPane>

                  <NTabPane name="general" tab="通用规则">
                    <div class="rule-scope-desc">
                      <span>按需启用，可按 Agent 分别配置</span>
                    </div>
                    <div class="rules-table">
                      <div class="table-header">
                        <div class="col-toggle">状态</div>
                        <div class="col-name">名称</div>
                        <div class="col-content">内容</div>
                        <div class="col-category">类别</div>
                        <div class="col-actions">操作</div>
                      </div>
                      <div
                        v-for="(rule, index) in rulesStore.generalRules"
                        :key="rule.id"
                        class="table-row"
                        :class="{ disabled: !rule.enabled }"
                        :style="{ animationDelay: `${index * 0.04}s` }"
                      >
                        <div class="col-toggle">
                          <NSwitch
                            :value="rule.enabled"
                            size="small"
                            @update:value="handleToggleRule(rule.id)"
                          />
                        </div>
                        <div class="col-name">
                          <span class="rule-name">{{ rule.name }}</span>
                          <span v-if="rule.is_builtin" class="builtin-tag">内置</span>
                        </div>
                        <div class="col-content" :title="rule.content">
                          {{ rule.content }}
                        </div>
                        <div class="col-category">
                          <span
                            class="category-tag"
                            :style="{
                              color: categoryMap[rule.category]?.color,
                              borderColor: categoryMap[rule.category]?.color + '40',
                              background: categoryMap[rule.category]?.color + '15',
                            }"
                          >
                            {{ categoryMap[rule.category]?.label || rule.category }}
                          </span>
                        </div>
                        <div class="col-actions">
                          <button
                            class="row-action-btn"
                            title="编辑"
                            @click="openEditRuleModal(rule)"
                          >
                            <NIcon :component="CreateOutline" :size="14" />
                          </button>
                          <button
                            v-if="!rule.is_builtin"
                            class="row-action-btn delete"
                            title="删除"
                            @click="handleDeleteRule(rule.id)"
                          >
                            <NIcon :component="TrashOutline" :size="14" />
                          </button>
                        </div>
                      </div>
                      <div
                        v-if="rulesStore.generalRules.length === 0"
                        class="table-empty"
                      >
                        <NIcon :component="OptionsOutline" :size="40" />
                        <p>暂无通用规则</p>
                        <span>点击「创建规则」添加第一条规则</span>
                      </div>
                    </div>
                  </NTabPane>
                </NTabs>
              </NSpin>
            </div>
          </NTabPane>

          <!-- 记忆管理 — 标签页 -->
          <NTabPane name="memories" tab="记忆管理">
            <div class="tab-content">
              <div class="section-header">
                <div class="section-title">
                  <div class="section-icon-wrap">
                    <NIcon :component="BookmarkOutline" :size="18" />
                  </div>
                  <div>
                    <span class="title-mono">MEMORIES</span>
                    <h3>长期记忆</h3>
                  </div>
                </div>
              </div>

              <NTabs
                v-model:value="memoryTab"
                type="segment"
                size="small"
                class="memory-tabs"
              >
                <NTabPane name="preference" tab="偏好" />
                <NTabPane name="fact" tab="事实" />
                <NTabPane name="event" tab="事件" />
              </NTabs>

              <NSpin :show="memoryStore.isLoading">
                <div class="memory-list">
                  <div
                    v-for="(memory, index) in currentMemories"
                    :key="memory.id"
                    class="memory-card"
                    :style="{ animationDelay: `${index * 0.04}s` }"
                  >
                    <div class="memory-icon">
                      <NIcon :component="SparklesOutline" :size="20" />
                    </div>
                    <div class="memory-info">
                      <div class="memory-content">{{ memory.content }}</div>
                      <div class="memory-meta">
                        <span class="memory-importance">
                          重要性: {{ memory.importance }}/10
                        </span>
                        <span class="memory-date">
                          {{ new Date(memory.created_at).toLocaleDateString('zh-CN') }}
                        </span>
                      </div>
                    </div>
                    <button
                      class="delete-btn"
                      @click="memoryStore.deleteMemory(memory.id)"
                    >
                      <NIcon :component="TrashOutline" :size="16" />
                    </button>
                  </div>

                  <div
                    v-if="currentMemories.length === 0 && !memoryStore.isLoading"
                    class="table-empty"
                  >
                    <NIcon :component="BookmarkOutline" :size="40" />
                    <p>暂无{{ memoryTabLabels[memoryTab] || '' }}记忆</p>
                    <span>AI 会自动从对话中提取重要信息</span>
                  </div>
                </div>
              </NSpin>
            </div>
          </NTabPane>

          <!-- 外观设置 -->
          <NTabPane name="appearance" tab="外观设置">
            <div class="tab-content">
              <div class="section-header">
                <div class="section-title">
                  <div class="section-icon-wrap">
                    <NIcon :component="DesktopOutline" :size="18" />
                  </div>
                  <div>
                    <span class="title-mono">APPEARANCE</span>
                    <h3>主题设置</h3>
                  </div>
                </div>
              </div>
              <div class="appearance-panel">
                <div class="theme-option-group">
                  <NRadioGroup
                    :value="themeStore.mode"
                    @update:value="(val: ThemeMode) => themeStore.setMode(val)"
                  >
                    <div class="theme-cards">
                      <div
                        v-for="option in themeOptions"
                        :key="option.value"
                        class="theme-card"
                        :class="{ active: themeStore.mode === option.value }"
                        @click="themeStore.setMode(option.value)"
                      >
                        <NRadio :value="option.value">
                          <div class="theme-card-content">
                            <div class="theme-icon">
                              <NIcon
                                v-if="option.value === 'light'"
                                :component="SunnyOutline"
                                :size="28"
                              />
                              <NIcon
                                v-else-if="option.value === 'dark'"
                                :component="MoonOutline"
                                :size="28"
                              />
                              <NIcon
                                v-else
                                :component="DesktopOutline"
                                :size="28"
                              />
                            </div>
                            <span class="theme-label">{{ option.label }}</span>
                          </div>
                        </NRadio>
                      </div>
                    </div>
                  </NRadioGroup>
                </div>
              </div>
            </div>
          </NTabPane>

          <!-- 系统设置 -->
          <NTabPane name="system" tab="系统设置">
            <div class="tab-content">
              <SystemSettingsPane />
            </div>
          </NTabPane>
        </NTabs>
      </div>
    </div>

    <!-- 规则创建/编辑 Modal -->
    <NModal
      v-model:show="showRuleModal"
      preset="card"
      :title="ruleModalTitle"
      style="width: 440px"
    >
      <NForm :model="ruleForm" label-placement="left" label-width="70">
        <NFormItem label="名称">
          <NInput v-model:value="ruleForm.name" placeholder="规则名称" />
        </NFormItem>
        <NFormItem label="内容">
          <NInput
            v-model:value="ruleForm.content"
            type="textarea"
            :rows="3"
            placeholder="规则内容"
          />
        </NFormItem>
        <NFormItem label="类别">
          <NSelect
            v-model:value="ruleForm.category"
            :options="categoryOptions"
          />
        </NFormItem>
        <NFormItem label="作用域">
          <NSelect
            v-model:value="ruleForm.scope"
            :options="scopeOptions"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-3">
          <button
            class="modal-btn cancel"
            @click="showRuleModal = false"
          >
            取消
          </button>
          <button class="modal-btn submit" @click="handleRuleSubmit">
            {{ editingRule ? "保存" : "创建" }}
          </button>
        </div>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.settings-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 16px;
  gap: 16px;
}

/* === Page Header === */
.page-header {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 28px;
}

.text-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 13px;
  cursor: pointer;
  padding: 6px 12px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.text-back-btn:hover {
  color: var(--color-primary);
  background: var(--color-primary-light);
}

.page-title-group {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
}

.title-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: var(--color-primary-light);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  color: var(--color-primary);
  flex-shrink: 0;
}

.title-mono {
  display: block;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 2px;
}

.page-title {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

/* === Content === */
.settings-content {
  flex: 1;
  overflow: hidden;
}

.tabs-wrapper {
  height: 100%;
  padding: 24px;
  overflow: hidden;
}

.tabs-wrapper :deep(.n-tabs) {
  height: 100%;
}

.tabs-wrapper :deep(.n-tabs-pane-wrapper) {
  height: calc(100% - 50px);
  overflow-y: auto;
}

.tab-content {
  padding: 20px 0;
}

.agent-tab-content {
  padding: 0;
}

/* === Section Header === */
.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.section-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: var(--color-primary-light);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  color: var(--color-primary);
  flex-shrink: 0;
}

.section-title h3 {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

/* === Buttons === */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  background: var(--color-primary);
  border: none;
  border-radius: var(--radius-sm);
  color: #fff;
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

:root.dark .btn-primary {
  color: var(--text-inverse);
}

.btn-primary:hover {
  background: var(--color-primary-hover);
}

.btn-sm {
  padding: 7px 14px;
  font-size: 12px;
}

/* === Rules Scope Tabs === */
.rule-scope-tabs {
  margin-bottom: 4px;
}

.rule-scope-desc {
  padding: 8px 0 12px;
  font-size: 12px;
  color: var(--text-muted);
}

.global-tag {
  padding: 1px 6px;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--neon-green);
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.global-row {
  opacity: 0.85;
}

/* === Rules Table === */
.rules-table {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  overflow: hidden;
}

.table-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  background: var(--bg-tertiary);
  border-bottom: 1px solid var(--border-subtle);
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

.table-row {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-subtle);
  transition: all var(--transition-fast);
  opacity: 0;
  animation: fadeInUp 0.3s ease-out forwards;
}

.table-row:last-child {
  border-bottom: none;
}

.table-row:hover {
  background: var(--color-primary-light);
}

.table-row.disabled {
  opacity: 0.5;
}

.col-toggle {
  width: 60px;
  flex-shrink: 0;
}

.col-name {
  width: 160px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.rule-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.builtin-tag {
  padding: 1px 6px;
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 3px;
  font-family: var(--font-mono);
  font-size: 9px;
  color: var(--neon-purple);
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.col-content {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.col-category {
  width: 80px;
  flex-shrink: 0;
}

.category-tag {
  display: inline-block;
  padding: 2px 10px;
  border: 1px solid;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.3px;
}

.col-actions {
  width: 80px;
  flex-shrink: 0;
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.table-row:hover .col-actions {
  opacity: 1;
}

.row-action-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.row-action-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.row-action-btn.delete:hover {
  border-color: var(--neon-pink);
  color: var(--neon-pink);
  background: rgba(247, 37, 133, 0.1);
}

/* === Empty States === */
.table-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  color: var(--text-muted);
}

.table-empty p {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-top: 16px;
  margin-bottom: 6px;
}

.table-empty span {
  font-size: 13px;
  color: var(--text-muted);
}

/* === Memory Tabs === */
.memory-tabs {
  margin-top: 4px;
  margin-bottom: 4px;
}

/* Memory Cards */
.memory-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.memory-card {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  transition: all var(--transition-smooth);
  opacity: 0;
  animation: fadeInUp 0.3s ease-out forwards;
}

.memory-card:hover {
  border-color: var(--border-glow);
}

.memory-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    135deg,
    rgba(0, 245, 212, 0.15) 0%,
    rgba(0, 245, 212, 0.05) 100%
  );
  border: 1px solid rgba(0, 245, 212, 0.2);
  border-radius: var(--radius-sm);
  color: var(--neon-cyan);
  flex-shrink: 0;
}

:root:not(.dark) .memory-icon {
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(6, 182, 212, 0.02) 100%);
  border-color: rgba(6, 182, 212, 0.15);
  color: #0891b2;
}

.memory-info {
  flex: 1;
  min-width: 0;
}

.memory-content {
  font-size: 14px;
  line-height: 1.6;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.memory-meta {
  display: flex;
  align-items: center;
  gap: 16px;
}

.memory-importance {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}

.memory-date {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--text-muted);
}

.delete-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0;
  transition: all var(--transition-fast);
  flex-shrink: 0;
}

.memory-card:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  border-color: var(--neon-pink);
  color: var(--neon-pink);
  background: rgba(247, 37, 133, 0.1);
}

/* === Appearance Panel === */
.appearance-panel {
  padding: 8px 0;
}

.theme-option-group {
  margin-bottom: 24px;
}

.theme-cards {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.theme-card {
  flex: 1;
  min-width: 140px;
  max-width: 200px;
  padding: 20px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-smooth);
}

.theme-card:hover {
  border-color: var(--border-hover);
}

.theme-card.active {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.theme-card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.theme-icon {
  color: var(--text-secondary);
  transition: color var(--transition-fast);
}

.theme-card.active .theme-icon {
  color: var(--color-primary);
}

.theme-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

/* === Modal Buttons === */
.modal-btn {
  display: flex;
  align-items: center;
  padding: 10px 24px;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.modal-btn.cancel {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.modal-btn.cancel:hover {
  border-color: var(--text-secondary);
}

.modal-btn.submit {
  background: var(--color-primary);
  border: none;
  color: #fff;
}

:root.dark .modal-btn.submit {
  color: var(--text-inverse);
}

.modal-btn.submit:hover {
  background: var(--color-primary-hover);
}
</style>
