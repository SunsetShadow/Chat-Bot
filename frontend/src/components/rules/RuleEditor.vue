<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRulesStore } from "@/stores/rules";
import type { RuleCreate } from "@/types";
import RuleItem from "./RuleItem.vue";
import { SettingsOutline, AddOutline } from "@vicons/ionicons5";

const rulesStore = useRulesStore();
const showModal = ref(false);
const editingRuleId = ref<string | null>(null);

const formValue = ref<RuleCreate>({
  name: "",
  content: "",
  category: "format",
});

const modalTitle = computed(() =>
  editingRuleId.value ? "编辑规则" : "创建规则",
);

const categoryOptions = [
  { label: "行为", value: "behavior" },
  { label: "格式", value: "format" },
  { label: "约束", value: "constraint" },
];

const enabledCount = computed(() => rulesStore.enabledRules.length);

onMounted(() => {
  rulesStore.fetchRules();
});

function openCreateModal() {
  editingRuleId.value = null;
  formValue.value = {
    name: "",
    content: "",
    category: "format",
  };
  showModal.value = true;
}

async function handleToggle(ruleId: string) {
  await rulesStore.toggleRule(ruleId);
}

async function handleSubmit() {
  try {
    if (editingRuleId.value) {
      await rulesStore.updateRule(editingRuleId.value, formValue.value);
    } else {
      await rulesStore.createRule(formValue.value);
    }
    showModal.value = false;
  } catch (error) {
    console.error("保存规则失败:", error);
  }
}
</script>

<template>
  <div class="rule-editor">
    <NPopover trigger="click" placement="bottom-end" :width="380">
      <template #trigger>
        <button class="rule-trigger">
          <NIcon :component="SettingsOutline" :size="18" />
          <span>规则</span>
          <span class="rule-count" v-if="enabledCount > 0">{{
            enabledCount
          }}</span>
        </button>
      </template>

      <div class="rule-popover">
        <div class="popover-header">
          <div class="header-info">
            <span class="label-mono">Rules</span>
            <span class="header-text">规则设置</span>
          </div>
          <button class="add-btn" @click="openCreateModal">
            <NIcon :component="AddOutline" :size="16" />
          </button>
        </div>

        <NSpin :show="rulesStore.isLoading">
          <div class="rule-list">
            <div
              v-for="rule in rulesStore.rules"
              :key="rule.id"
              class="rule-wrapper"
            >
              <RuleItem :rule="rule" @toggle="handleToggle" />
            </div>
            <div v-if="rulesStore.rules.length === 0" class="empty-state">
              <span class="empty-text">暂无规则</span>
            </div>
          </div>
        </NSpin>
      </div>
    </NPopover>

    <!-- Modal -->
    <NModal
      v-model:show="showModal"
      preset="card"
      :title="modalTitle"
      style="width: 440px"
    >
      <NForm :model="formValue" label-placement="left" label-width="70">
        <NFormItem label="名称">
          <NInput v-model:value="formValue.name" placeholder="规则名称" />
        </NFormItem>
        <NFormItem label="内容">
          <NInput
            v-model:value="formValue.content"
            type="textarea"
            :rows="3"
            placeholder="规则内容"
          />
        </NFormItem>
        <NFormItem label="类别">
          <NSelect
            v-model:value="formValue.category"
            :options="categoryOptions"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="modal-footer">
          <button class="btn-cancel" @click="showModal = false">取消</button>
          <button class="btn-submit" @click="handleSubmit">
            {{ editingRuleId ? "保存" : "创建" }}
          </button>
        </div>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.rule-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-smooth);
}

.rule-trigger:hover {
  border-color: var(--neon-cyan);
  color: var(--neon-cyan);
}

.rule-count {
  padding: 2px 6px;
  background: var(--neon-cyan);
  border-radius: 10px;
  color: var(--bg-primary);
  font-size: 11px;
  font-weight: 600;
}

.rule-popover {
  padding: 4px;
}

.popover-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 16px;
  margin-bottom: 16px;
  border-bottom: 1px solid var(--border-subtle);
}

.header-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.header-text {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.add-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.add-btn:hover {
  border-color: var(--neon-cyan);
  color: var(--neon-cyan);
}

.rule-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
}

.rule-wrapper {
  opacity: 0;
  animation: fadeInUp 0.3s ease-out forwards;
}

.empty-state {
  padding: 32px;
  text-align: center;
}

.empty-text {
  font-size: 14px;
  color: var(--text-muted);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-cancel,
.btn-submit {
  padding: 10px 20px;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-cancel {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
}

.btn-cancel:hover {
  border-color: var(--text-secondary);
}

.btn-submit {
  background: var(--neon-cyan);
  border: none;
  color: var(--bg-primary);
}

.btn-submit:hover {
  box-shadow: 0 0 20px rgba(0, 245, 212, 0.4);
}
</style>
