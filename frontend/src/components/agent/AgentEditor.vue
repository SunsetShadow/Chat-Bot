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
  <div class="agent-editor">
    <!-- Header -->
    <div class="editor-header">
      <div class="header-info">
        <span class="label-mono">Agents</span>
        <h3>智能助手</h3>
      </div>
      <button class="create-btn" @click="openCreateModal">
        <NIcon :component="AddOutline" :size="18" />
        <span>创建</span>
      </button>
    </div>

    <!-- Agent List -->
    <NSpin :show="agentStore.isLoading">
      <div class="agent-list">
        <div
          v-for="(agent, index) in agentStore.agents"
          :key="agent.id"
          class="agent-card"
          :style="{ animationDelay: `${index * 0.08}s` }"
        >
          <div class="agent-icon">
            <NIcon :component="SparklesOutline" :size="22" />
          </div>
          <div class="agent-info">
            <div class="agent-name">
              {{ agent.name }}
              <span v-if="agent.is_builtin" class="builtin-badge">内置</span>
            </div>
            <div class="agent-desc">{{ agent.description }}</div>
            <div class="agent-traits">
              <span
                v-for="trait in agent.traits"
                :key="trait"
                class="trait-tag"
              >
                {{ trait }}
              </span>
            </div>
          </div>
          <div class="agent-actions">
            <button class="action-btn" @click="openEditModal(agent.id)">
              <NIcon :component="CreateOutline" :size="18" />
            </button>
            <button
              v-if="!agent.is_builtin"
              class="action-btn delete"
              @click="handleDelete(agent.id)"
            >
              <NIcon :component="TrashOutline" :size="18" />
            </button>
          </div>
        </div>

        <div v-if="agentStore.agents.length === 0" class="empty-state">
          <div class="empty-icon">
            <NIcon :component="SparklesOutline" :size="40" />
          </div>
          <p class="empty-text">暂无 Agent</p>
          <p class="empty-hint">点击上方按钮创建</p>
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
        <div class="modal-footer">
          <button class="btn-cancel" @click="showModal = false">取消</button>
          <button class="btn-submit" @click="handleSubmit">
            {{ editingAgentId ? "保存" : "创建" }}
          </button>
        </div>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.agent-editor {
  padding: 0;
}

.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border-color);
}

.header-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.header-info h3 {
  font-family: var(--font-display);
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.create-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  background: var(--color-primary);
  border: none;
  border-radius: var(--radius-sm);
  color: var(--text-inverse);
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.create-btn:hover {
  background: var(--color-primary-hover);
}

.agent-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.agent-card {
  display: flex;
  gap: 16px;
  padding: 20px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  transition: all var(--transition-fast);
  opacity: 0;
  animation: fadeInUp 0.3s ease-out forwards;
}

.agent-card:hover {
  border-color: var(--color-primary);
  box-shadow: var(--shadow-primary);
}

.agent-icon {
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-light);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  color: var(--color-primary);
  flex-shrink: 0;
}

.agent-info {
  flex: 1;
  min-width: 0;
}

.agent-name {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 6px;
}

.builtin-badge {
  padding: 3px 8px;
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: #8b5cf6;
  letter-spacing: 0.5px;
}

.agent-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 10px;
}

.agent-traits {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.trait-tag {
  padding: 4px 10px;
  background: var(--color-primary-light);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-primary);
  letter-spacing: 0.3px;
}

.agent-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.agent-card:hover .agent-actions {
  opacity: 1;
}

.action-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.action-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.action-btn.delete:hover {
  border-color: var(--color-error);
  color: var(--color-error);
  background: rgba(239, 68, 68, 0.1);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;
  text-align: center;
}

.empty-icon {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  color: var(--text-muted);
  margin-bottom: 20px;
}

.empty-text {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 13px;
  color: var(--text-muted);
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.btn-cancel,
.btn-submit {
  padding: 12px 24px;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-cancel {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
}

.btn-cancel:hover {
  border-color: var(--text-secondary);
}

.btn-submit {
  background: var(--color-primary);
  border: none;
  color: var(--text-inverse);
}

.btn-submit:hover {
  background: var(--color-primary-hover);
}
</style>
