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
  <div>
    <NPopover trigger="click" placement="bottom-end" :width="380">
      <template #trigger>
        <button
          class="flex items-center gap-2 px-4 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-[var(--radius-sm)] text-[var(--text-secondary)] font-mono text-[13px] cursor-pointer transition-all duration-150 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
        >
          <NIcon :component="SettingsOutline" :size="18" />
          <span>规则</span>
          <span
            v-if="enabledCount > 0"
            class="px-1.5 py-0.5 bg-[var(--color-primary)] rounded-[10px] text-white text-[11px] font-semibold"
          >
            {{ enabledCount }}
          </span>
        </button>
      </template>

      <div class="p-1">
        <div
          class="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border-color)]"
        >
          <div class="flex flex-col gap-0.5">
            <span
              class="font-mono text-[11px] tracking-wider uppercase text-[var(--text-muted)]"
              >Rules</span
            >
            <span class="text-[15px] font-medium text-[var(--text-primary)]"
              >规则设置</span
            >
          </div>
          <button
            class="w-8 h-8 flex items-center justify-center bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-[var(--radius-sm)] text-[var(--text-secondary)] cursor-pointer transition-all duration-150 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
            @click="openCreateModal"
          >
            <NIcon :component="AddOutline" :size="16" />
          </button>
        </div>

        <NSpin :show="rulesStore.isLoading">
          <div class="flex flex-col gap-2 max-h-[320px] overflow-y-auto">
            <div
              v-for="(rule, index) in rulesStore.rules"
              :key="rule.id"
              class="opacity-0 animate-[fadeInUp_0.3s_ease-out_forwards]"
              :style="{ animationDelay: `${index * 0.05}s` }"
            >
              <RuleItem :rule="rule" @toggle="handleToggle" />
            </div>
            <div v-if="rulesStore.rules.length === 0" class="py-8 text-center">
              <span class="text-sm text-[var(--text-muted)]">暂无规则</span>
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
        <div class="flex justify-end gap-3">
          <button
            class="px-5 py-2.5 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-[var(--radius-sm)] font-mono text-[13px] font-medium text-[var(--text-secondary)] cursor-pointer transition-all duration-150 hover:border-[var(--text-secondary)]"
            @click="showModal = false"
          >
            取消
          </button>
          <button
            class="px-5 py-2.5 bg-[var(--color-primary)] border-none rounded-[var(--radius-sm)] font-mono text-[13px] font-medium text-white cursor-pointer transition-all duration-150 hover:bg-[var(--color-primary-hover)]"
            @click="handleSubmit"
          >
            {{ editingRuleId ? "保存" : "创建" }}
          </button>
        </div>
      </template>
    </NModal>
  </div>
</template>
