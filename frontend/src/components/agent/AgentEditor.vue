<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useAgentStore } from "@/stores/agent";
import type { AgentCreate } from "@/types";
import {
  AddOutline,
  CreateOutline,
  TrashOutline,
  SparklesOutline,
} from "@vicons/ionicons5";

const _emit = defineEmits<{
  close: [];
}>();

const agentStore = useAgentStore();
const showModal = ref(false);
const editingAgentId = ref<string | null>(null);

const formValue = ref<AgentCreate>({
  name: "",
  description: "",
  system_prompt: "",
  traits: [],
});

const modalTitle = computed(() =>
  editingAgentId.value ? "编辑 Agent" : "创建 Agent",
);

onMounted(() => {
  agentStore.fetchAgents();
});

function openCreateModal() {
  editingAgentId.value = null;
  formValue.value = {
    name: "",
    description: "",
    system_prompt: "",
    traits: [],
  };
  showModal.value = true;
}

function openEditModal(agentId: string) {
  const agent = agentStore.agents.find((a) => a.id === agentId);
  if (!agent) return;

  editingAgentId.value = agentId;
  formValue.value = {
    name: agent.name,
    description: agent.description,
    system_prompt: agent.system_prompt,
    traits: [...agent.traits],
  };
  showModal.value = true;
}

async function handleSubmit() {
  try {
    if (editingAgentId.value) {
      await agentStore.updateAgent(editingAgentId.value, formValue.value);
    } else {
      await agentStore.createAgent(formValue.value);
    }
    showModal.value = false;
  } catch (error) {
    console.error("保存 Agent 失败:", error);
  }
}

async function handleDelete(agentId: string) {
  try {
    await agentStore.deleteAgent(agentId);
  } catch (error) {
    console.error("删除 Agent 失败:", error);
  }
}
</script>

<template>
  <div>
    <!-- Header -->
    <div
      class="flex items-center justify-between mb-6 pb-4 border-b border-[var(--border-color)]"
    >
      <div class="flex flex-col gap-1">
        <span
          class="font-mono text-[11px] tracking-wider uppercase text-[var(--text-muted)]"
          >Agents</span
        >
        <h3 class="text-lg font-semibold text-[var(--text-primary)]">
          智能助手
        </h3>
      </div>
      <button
        class="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-primary)] border-none rounded-[var(--radius-sm)] text-white font-mono text-[13px] font-medium cursor-pointer transition-all duration-150 hover:bg-[var(--color-primary-hover)]"
        @click="openCreateModal"
      >
        <NIcon :component="AddOutline" :size="18" />
        <span>创建</span>
      </button>
    </div>

    <!-- Agent List -->
    <NSpin :show="agentStore.isLoading">
      <div class="flex flex-col gap-4">
        <div
          v-for="(agent, index) in agentStore.agents"
          :key="agent.id"
          class="flex gap-4 p-5 bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-2xl transition-all duration-150 opacity-0 animate-[fadeInUp_0.3s_ease-out_forwards] hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-primary)] group"
          :style="{ animationDelay: `${index * 0.08}s` }"
        >
          <div
            class="w-12 h-12 flex items-center justify-center bg-[var(--color-primary-light)] border border-[var(--color-primary)] rounded-[var(--radius-md)] text-[var(--color-primary)] shrink-0"
          >
            <NIcon :component="SparklesOutline" :size="22" />
          </div>
          <div class="flex-1 min-w-0">
            <div
              class="flex items-center gap-2.5 text-base font-semibold text-[var(--text-primary)] mb-1.5"
            >
              {{ agent.name }}
              <span
                v-if="agent.is_builtin"
                class="px-2 py-0.5 bg-[rgba(139,92,246,0.1)] border border-[rgba(139,92,246,0.3)] rounded font-mono text-[10px] text-purple-500 tracking-wide"
                >内置</span
              >
            </div>
            <div
              class="text-[13px] text-[var(--text-secondary)] leading-relaxed mb-2.5"
            >
              {{ agent.description }}
            </div>
            <div class="flex flex-wrap gap-1.5">
              <span
                v-for="trait in agent.traits"
                :key="trait"
                class="px-2.5 py-1 bg-[var(--color-primary-light)] border border-[rgba(59,130,246,0.2)] rounded font-mono text-[11px] text-[var(--color-primary)] tracking-wide"
              >
                {{ trait }}
              </span>
            </div>
          </div>
          <div
            class="flex flex-col gap-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100"
          >
            <button
              class="w-9 h-9 flex items-center justify-center bg-transparent border border-[var(--border-color)] rounded-[var(--radius-sm)] text-[var(--text-muted)] cursor-pointer transition-all duration-150 hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
              @click="openEditModal(agent.id)"
            >
              <NIcon :component="CreateOutline" :size="18" />
            </button>
            <button
              v-if="!agent.is_builtin"
              class="w-9 h-9 flex items-center justify-center bg-transparent border border-[var(--border-color)] rounded-[var(--radius-sm)] text-[var(--text-muted)] cursor-pointer transition-all duration-150 hover:border-[var(--color-error)] hover:text-[var(--color-error)] hover:bg-[rgba(239,68,68,0.1)]"
              @click="handleDelete(agent.id)"
            >
              <NIcon :component="TrashOutline" :size="18" />
            </button>
          </div>
        </div>

        <div
          v-if="agentStore.agents.length === 0"
          class="flex flex-col items-center py-16 px-5 text-center"
        >
          <div
            class="w-20 h-20 flex items-center justify-center bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-2xl text-[var(--text-muted)] mb-5"
          >
            <NIcon :component="SparklesOutline" :size="40" />
          </div>
          <p class="text-base font-medium text-[var(--text-secondary)] mb-2">
            暂无 Agent
          </p>
          <p class="text-[13px] text-[var(--text-muted)]">点击上方按钮创建</p>
        </div>
      </div>
    </NSpin>

    <!-- Modal -->
    <NModal
      v-model:show="showModal"
      preset="card"
      :title="modalTitle"
      style="width: 520px"
    >
      <NForm :model="formValue" label-placement="left" label-width="90">
        <NFormItem label="名称">
          <NInput
            v-model:value="formValue.name"
            placeholder="输入 Agent 名称"
          />
        </NFormItem>
        <NFormItem label="描述">
          <NInput
            v-model:value="formValue.description"
            type="textarea"
            placeholder="描述这个 Agent 的作用"
          />
        </NFormItem>
        <NFormItem label="系统提示词">
          <NInput
            v-model:value="formValue.system_prompt"
            type="textarea"
            :rows="4"
            placeholder="定义 Agent 的角色和行为规则"
          />
        </NFormItem>
        <NFormItem label="特征标签">
          <NDynamicTags v-model:value="formValue.traits" />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-3">
          <button
            class="px-6 py-3 bg-[var(--bg-tertiary)] border border-[var(--border-color)] rounded-[var(--radius-sm)] font-mono text-[13px] font-medium text-[var(--text-secondary)] cursor-pointer transition-all duration-150 hover:border-[var(--text-secondary)]"
            @click="showModal = false"
          >
            取消
          </button>
          <button
            class="px-6 py-3 bg-[var(--color-primary)] border-none rounded-[var(--radius-sm)] font-mono text-[13px] font-medium text-white cursor-pointer transition-all duration-150 hover:bg-[var(--color-primary-hover)]"
            @click="handleSubmit"
          >
            {{ editingAgentId ? "保存" : "创建" }}
          </button>
        </div>
      </template>
    </NModal>
  </div>
</template>
