<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useAgentStore } from "@/stores/agent";
import { getTools } from "@/api/chat";
import type {
  Agent,
  AgentCreate,
  AgentUpdate,
  ToolInfo,
  AgentTemplate,
} from "@/types";
import {
  ArrowBackOutline,
  AddOutline,
  CreateOutline,
  TrashOutline,
  SparklesOutline,
  GitMergeOutline,
  BuildOutline,
  ChevronDownOutline,
  CopyOutline,
  FlashOutline,
} from "@vicons/ionicons5";

const router = useRouter();
const agentStore = useAgentStore();
const message = useMessage();
const dialog = useDialog();

// 工具列表
const availableTools = ref<ToolInfo[]>([]);
const toolsLoaded = ref(false);

// 模态框状态
const showModal = ref(false);
const editingAgentId = ref<string | null>(null);
const saving = ref(false);

// 表单
const formValue = ref<AgentCreate>({
  name: "",
  description: "",
  system_prompt: "",
  traits: [],
  tools: [],
  skills: [],
  model_name: "",
  capabilities: "",
  enabled: true,
  temperature: undefined,
});

// 是否正在编辑内置 Agent
const editingBuiltin = ref(false);

// 模板相关
const showTemplateModal = ref(false);

const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    name: "客服助手",
    description: "专业的客户服务，处理用户咨询和问题",
    system_prompt:
      "你是一个专业的客户服务代表。请耐心倾听用户问题，提供准确、友好的解答。遇到无法解决的问题，请建议用户联系人工客服。",
    traits: ["耐心", "专业", "友好"],
    tools: ["extract_memory", "knowledge_query"],
    capabilities: "处理用户咨询、问题排查、服务引导",
    temperature: 0.3,
    icon: "🎧",
  },
  {
    name: "数据分析师",
    description: "数据分析专家，擅长数据解读和可视化建议",
    system_prompt:
      "你是一个数据分析师。请用数据驱动的方式回答问题，提供清晰的图表建议和洞察分析。注重数据的准确性和可操作性。",
    traits: ["严谨", "数据驱动", "洞察力"],
    tools: ["extract_memory", "web_search", "knowledge_query"],
    capabilities: "数据分析、趋势解读、可视化建议、统计推断",
    temperature: 0.2,
    icon: "📊",
  },
  {
    name: "翻译专家",
    description: "多语言翻译，支持中英日韩等语言",
    system_prompt:
      "你是一个专业的翻译专家。请提供准确、自然的翻译，保持原文的语气和风格。如有多种译法，请说明差异。",
    traits: ["准确", "自然", "多语言"],
    tools: ["extract_memory"],
    capabilities: "多语言翻译、本地化、术语管理",
    temperature: 0.3,
    icon: "🌐",
  },
  {
    name: "创意策划",
    description: "创意策划与头脑风暴，激发灵感",
    system_prompt:
      "你是一个创意策划师。请用发散思维帮助用户头脑风暴，提供新颖独特的创意方案。不设限，鼓励大胆想象。",
    traits: ["创意", "发散思维", "有趣"],
    tools: ["extract_memory", "web_search"],
    capabilities: "创意策划、头脑风暴、方案设计、灵感激发",
    temperature: 1.2,
    icon: "💡",
  },
];

function openTemplateModal() {
  showTemplateModal.value = true;
}

function applyTemplate(template: AgentTemplate) {
  formValue.value = {
    name: template.name,
    description: template.description,
    system_prompt: template.system_prompt,
    traits: [...template.traits],
    tools: [...template.tools],
    skills: [],
    model_name: "",
    capabilities: template.capabilities,
    enabled: true,
    temperature: template.temperature,
  };
  showTemplateModal.value = false;
  showModal.value = true;
}

function duplicateAgent(agent: Agent) {
  formValue.value = {
    name: `${agent.name} (副本)`,
    description: agent.description,
    system_prompt: agent.system_prompt,
    traits: [...agent.traits],
    tools: [...agent.tools],
    skills: [...agent.skills],
    model_name: agent.model_name || "",
    capabilities: agent.capabilities || "",
    enabled: true,
    temperature: agent.temperature,
  };
  editingAgentId.value = null;
  editingBuiltin.value = false;
  showModal.value = true;
}

// 展开/折叠系统提示词
const expandedAgents = ref<Set<string>>(new Set());

const modalTitle = computed(() =>
  editingAgentId.value ? "编辑 Agent" : "创建 Agent",
);

const customAgents = computed(() =>
  agentStore.agents.filter((a) => !a.is_builtin),
);

const builtinAgents = computed(() =>
  agentStore.agents.filter((a) => a.is_builtin),
);

// 工具选项
const toolOptions = computed(() =>
  availableTools.value.map((t) => ({
    label: t.name,
    value: t.name,
  })),
);

// 多 Agent 合作提示
const cooperationHint = computed(() => {
  const total = agentStore.agents.length;
  if (total < 2) return "至少需要 2 个 Agent 才能启用多 Agent 协作";
  return `当前 ${total} 个 Agent，Supervisor 将自动路由请求到最合适的 Agent`;
});

onMounted(async () => {
  try {
    await agentStore.fetchAgents();
  } catch {
    console.warn("获取 Agent 列表失败");
  }
  try {
    availableTools.value = await getTools();
    toolsLoaded.value = true;
  } catch {
    console.warn("获取工具列表失败");
  }
});

function goBack() {
  router.push("/");
}

function toggleExpand(id: string) {
  if (expandedAgents.value.has(id)) {
    expandedAgents.value.delete(id);
  } else {
    expandedAgents.value.add(id);
  }
}

function openCreateModal() {
  editingAgentId.value = null;
  editingBuiltin.value = false;
  formValue.value = {
    name: "",
    description: "",
    system_prompt: "",
    traits: [],
    tools: [],
    skills: [],
    model_name: "",
    capabilities: "",
    enabled: true,
    temperature: undefined,
  };
  showModal.value = true;
}

function openEditModal(agent: Agent) {
  editingAgentId.value = agent.id;
  editingBuiltin.value = agent.is_builtin;
  formValue.value = {
    name: agent.name,
    description: agent.description,
    system_prompt: agent.system_prompt,
    traits: [...agent.traits],
    tools: [...agent.tools],
    skills: [...agent.skills],
    model_name: agent.model_name || "",
    capabilities: agent.capabilities || "",
    enabled: agent.enabled,
    temperature: agent.temperature,
  };
  showModal.value = true;
}

async function handleSubmit() {
  if (!formValue.value.name?.trim()) {
    message.warning("请输入 Agent 名称");
    return;
  }
  if (!formValue.value.system_prompt?.trim()) {
    message.warning("请输入系统提示词");
    return;
  }
  saving.value = true;
  try {
    if (editingAgentId.value) {
      await agentStore.updateAgent(
        editingAgentId.value,
        formValue.value as AgentUpdate,
      );
      message.success("Agent 更新成功");
    } else {
      await agentStore.createAgent(formValue.value);
      message.success("Agent 创建成功");
    }
    showModal.value = false;
  } catch (error) {
    const msg = error instanceof Error ? error.message : "操作失败";
    message.error(msg);
  } finally {
    saving.value = false;
  }
}

async function handleDelete(id: string) {
  const agent = agentStore.agents.find((a) => a.id === id);
  if (!agent) return;

  dialog.warning({
    title: "确认删除",
    content: `确定要删除 Agent「${agent.name}」吗？此操作不可恢复。`,
    positiveText: "删除",
    negativeText: "取消",
    onPositiveClick: async () => {
      try {
        await agentStore.deleteAgent(id);
        message.success("Agent 已删除");
      } catch (error) {
        const msg = error instanceof Error ? error.message : "删除失败";
        message.error(msg);
      }
    },
  });
}

function truncatePrompt(prompt: string, max = 120): string {
  if (!prompt) return "";
  return prompt.length > max ? prompt.slice(0, max) + "..." : prompt;
}
</script>

<template>
  <div class="agent-config-view">
    <!-- Header -->
    <header class="config-header glass-card">
      <button class="back-btn" @click="goBack">
        <NIcon :component="ArrowBackOutline" :size="20" />
        <span>返回</span>
      </button>
      <div class="header-title">
        <span class="label-mono">Agent Config</span>
        <h2>Agent 配置中心</h2>
      </div>
      <div class="create-actions">
        <button class="create-btn template" @click="openTemplateModal">
          <NIcon :component="FlashOutline" :size="18" />
          <span>模板创建</span>
        </button>
        <button class="create-btn" @click="openCreateModal">
          <NIcon :component="AddOutline" :size="18" />
          <span>空白创建</span>
        </button>
      </div>
    </header>

    <!-- 多 Agent 协作状态 -->
    <div class="cooperation-bar glass-card">
      <div class="coop-icon">
        <NIcon :component="GitMergeOutline" :size="20" />
      </div>
      <div class="coop-info">
        <span class="coop-label">多 Agent 协作</span>
        <span class="coop-hint">{{ cooperationHint }}</span>
      </div>
      <div
        class="coop-status"
        :class="{ active: agentStore.agents.length >= 2 }"
      >
        <span class="status-dot"></span>
        <span>{{ agentStore.agents.length >= 2 ? "已启用" : "未启用" }}</span>
      </div>
    </div>

    <!-- Agent 列表 -->
    <div class="agent-list-content">
      <!-- 自定义 Agent -->
      <div v-if="customAgents.length > 0" class="agent-section">
        <div class="section-label">
          <NIcon :component="SparklesOutline" :size="16" />
          <span>自定义 Agent</span>
          <span class="section-count">{{ customAgents.length }}</span>
        </div>
        <div class="agent-cards">
          <div
            v-for="agent in customAgents"
            :key="agent.id"
            class="agent-card glass-card"
          >
            <div class="card-header">
              <div class="agent-avatar">
                <NIcon :component="SparklesOutline" :size="22" />
              </div>
              <div class="agent-meta">
                <h4>{{ agent.name }}</h4>
                <span class="agent-desc">{{ agent.description }}</span>
              </div>
              <div class="card-actions">
                <button
                  class="action-btn edit"
                  title="编辑"
                  @click="openEditModal(agent)"
                >
                  <NIcon :component="CreateOutline" :size="16" />
                </button>
                <button
                  class="action-btn copy"
                  title="复制"
                  @click="duplicateAgent(agent)"
                >
                  <NIcon :component="CopyOutline" :size="16" />
                </button>
                <button
                  class="action-btn delete"
                  title="删除"
                  @click="handleDelete(agent.id)"
                >
                  <NIcon :component="TrashOutline" :size="16" />
                </button>
              </div>
            </div>

            <!-- 详细信息 -->
            <div class="card-body">
              <!-- 工具 -->
              <div class="info-row">
                <span class="info-label">
                  <NIcon :component="BuildOutline" :size="14" />
                  工具
                </span>
                <div class="info-value">
                  <span
                    v-for="tool in agent.tools"
                    :key="tool"
                    class="tool-tag"
                  >
                    {{ tool }}
                  </span>
                  <span v-if="!agent.tools?.length" class="muted">无</span>
                </div>
              </div>

              <!-- 特征 -->
              <div class="info-row">
                <span class="info-label">特征</span>
                <div class="info-value">
                  <span
                    v-for="trait in agent.traits"
                    :key="trait"
                    class="trait-tag"
                  >
                    {{ trait }}
                  </span>
                </div>
              </div>

              <!-- 系统提示词（可展开） -->
              <div class="prompt-row">
                <button class="prompt-toggle" @click="toggleExpand(agent.id)">
                  <span>系统提示词</span>
                  <NIcon
                    :component="ChevronDownOutline"
                    :size="14"
                    :class="{ rotated: expandedAgents.has(agent.id) }"
                  />
                </button>
                <div v-if="expandedAgents.has(agent.id)" class="prompt-content">
                  {{ agent.system_prompt }}
                </div>
                <div v-else class="prompt-preview">
                  {{ truncatePrompt(agent.system_prompt) }}
                </div>
              </div>

              <!-- 模型 -->
              <div v-if="agent.model_name" class="info-row">
                <span class="info-label">模型</span>
                <span class="model-tag">{{ agent.model_name }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 内置 Agent -->
      <div v-if="builtinAgents.length > 0" class="agent-section">
        <div class="section-label">
          <NIcon :component="SparklesOutline" :size="16" />
          <span>内置 Agent</span>
          <span class="section-count">{{ builtinAgents.length }}</span>
        </div>
        <div class="agent-cards">
          <div
            v-for="agent in builtinAgents"
            :key="agent.id"
            class="agent-card glass-card builtin"
          >
            <div class="card-header">
              <div class="agent-avatar builtin-avatar">
                <NIcon :component="SparklesOutline" :size="22" />
              </div>
              <div class="agent-meta">
                <h4>
                  {{ agent.name }}
                  <span class="builtin-badge">内置</span>
                </h4>
                <span class="agent-desc">{{ agent.description }}</span>
              </div>
              <div class="card-actions">
                <button
                  class="action-btn edit"
                  title="编辑"
                  @click="openEditModal(agent)"
                >
                  <NIcon :component="CreateOutline" :size="16" />
                </button>
                <button
                  class="action-btn copy"
                  title="复制"
                  @click="duplicateAgent(agent)"
                >
                  <NIcon :component="CopyOutline" :size="16" />
                </button>
              </div>
            </div>

            <div class="card-body">
              <div class="info-row">
                <span class="info-label">
                  <NIcon :component="BuildOutline" :size="14" />
                  工具
                </span>
                <div class="info-value">
                  <span
                    v-for="tool in agent.tools"
                    :key="tool"
                    class="tool-tag"
                  >
                    {{ tool }}
                  </span>
                </div>
              </div>
              <div class="info-row">
                <span class="info-label">特征</span>
                <div class="info-value">
                  <span
                    v-for="trait in agent.traits"
                    :key="trait"
                    class="trait-tag"
                  >
                    {{ trait }}
                  </span>
                </div>
              </div>
              <div class="prompt-row">
                <button class="prompt-toggle" @click="toggleExpand(agent.id)">
                  <span>系统提示词</span>
                  <NIcon
                    :component="ChevronDownOutline"
                    :size="14"
                    :class="{ rotated: expandedAgents.has(agent.id) }"
                  />
                </button>
                <div v-if="expandedAgents.has(agent.id)" class="prompt-content">
                  {{ agent.system_prompt }}
                </div>
                <div v-else class="prompt-preview">
                  {{ truncatePrompt(agent.system_prompt) }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div
        v-if="agentStore.agents.length === 0 && !agentStore.isLoading"
        class="empty-state"
      >
        <div class="empty-icon">
          <NIcon :component="SparklesOutline" :size="48" />
        </div>
        <p class="empty-title">暂无 Agent</p>
        <p class="empty-hint">点击「创建 Agent」开始配置</p>
      </div>
    </div>

    <!-- 创建/编辑 Modal -->
    <NModal
      v-model:show="showModal"
      preset="card"
      :title="modalTitle"
      style="width: 600px"
    >
      <NForm :model="formValue" label-placement="left" label-width="100">
        <!-- 内置 Agent 编辑提示 -->
        <div v-if="editingBuiltin" class="builtin-warning">
          <span
            >内置 Agent
            仅允许修改行为配置（提示词、工具、温度等），不允许修改名称或删除。</span
          >
        </div>
        <NFormItem label="名称" required>
          <NInput
            v-model:value="formValue.name"
            placeholder="输入 Agent 名称"
            :disabled="editingBuiltin"
          />
        </NFormItem>
        <NFormItem label="描述">
          <NInput
            v-model:value="formValue.description"
            type="textarea"
            placeholder="描述这个 Agent 的作用"
            :disabled="editingBuiltin"
          />
        </NFormItem>
        <NFormItem label="系统提示词">
          <NInput
            v-model:value="formValue.system_prompt"
            type="textarea"
            :rows="5"
            placeholder="定义 Agent 的角色、能力和行为规则"
          />
        </NFormItem>
        <NFormItem label="能力描述">
          <NInput
            v-model:value="formValue.capabilities"
            type="textarea"
            :rows="2"
            placeholder="描述 Agent 的核心能力，用于 Supervisor 路由决策"
          />
        </NFormItem>
        <NFormItem label="工具">
          <NSelect
            v-model:value="formValue.tools"
            :options="toolOptions"
            multiple
            placeholder="选择可用工具"
            :disabled="!toolsLoaded"
          />
        </NFormItem>
        <NFormItem label="特征标签">
          <NDynamicTags v-model:value="formValue.traits" />
        </NFormItem>
        <NFormItem label="模型">
          <NInput
            v-model:value="formValue.model_name"
            placeholder="留空使用默认模型"
            :disabled="editingBuiltin"
          />
        </NFormItem>
        <NFormItem label="温度">
          <NSlider
            v-model:value="formValue.temperature"
            :min="0"
            :max="2"
            :step="0.1"
            :marks="{ 0: '精确', 1: '平衡', 2: '创意' }"
          />
        </NFormItem>
        <NFormItem v-if="!editingBuiltin" label="启用">
          <NSwitch v-model:value="formValue.enabled" />
        </NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-3">
          <button class="modal-btn cancel" @click="showModal = false">
            取消
          </button>
          <button
            class="modal-btn submit"
            :disabled="saving"
            @click="handleSubmit"
          >
            <NSpin v-if="saving" :size="16" style="margin-right: 6px" />
            {{ editingAgentId ? "保存" : "创建" }}
          </button>
        </div>
      </template>
    </NModal>

    <!-- 模板选择 Modal -->
    <NModal
      v-model:show="showTemplateModal"
      preset="card"
      title="选择 Agent 模板"
      style="width: 520px"
    >
      <div class="template-grid">
        <button
          v-for="tpl in AGENT_TEMPLATES"
          :key="tpl.name"
          class="template-card"
          @click="applyTemplate(tpl)"
        >
          <span class="template-icon">{{ tpl.icon }}</span>
          <div class="template-info">
            <span class="template-name">{{ tpl.name }}</span>
            <span class="template-desc">{{ tpl.description }}</span>
          </div>
        </button>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
.agent-config-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  padding: 16px;
  gap: 16px;
}

.config-header {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 16px 24px;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: transparent;
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-size: 13px;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.back-btn:hover {
  border-color: var(--neon-cyan);
  color: var(--neon-cyan);
}

.header-title {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.header-title h2 {
  font-family: var(--font-display);
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
}

.label-mono {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--text-muted);
}

.create-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 20px;
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

.create-btn:hover {
  background: var(--color-primary-hover);
}

/* 协作状态栏 */
.cooperation-bar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 14px 20px;
}

.coop-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(
    135deg,
    rgba(0, 245, 212, 0.15),
    rgba(0, 245, 212, 0.05)
  );
  border: 1px solid rgba(0, 245, 212, 0.2);
  border-radius: var(--radius-sm);
  color: var(--neon-cyan);
  flex-shrink: 0;
}

.coop-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.coop-label {
  font-weight: 600;
  font-size: 14px;
  color: var(--text-primary);
}

.coop-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.coop-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  border-radius: var(--radius-sm);
  font-family: var(--font-mono);
  font-size: 12px;
  background: var(--bg-tertiary);
  color: var(--text-muted);
}

.coop-status.active {
  background: rgba(6, 214, 160, 0.1);
  border: 1px solid rgba(6, 214, 160, 0.3);
  color: var(--neon-green);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
}

.coop-status.active .status-dot {
  background: var(--neon-green);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.4;
  }
}

/* Agent 列表 */
.agent-list-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.agent-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  padding-left: 4px;
}

.section-count {
  padding: 1px 8px;
  background: var(--color-primary-light);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 10px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-primary);
}

.agent-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 16px;
}

/* Agent 卡片 */
.agent-card {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 20px;
  transition: all var(--transition-smooth);
}

.agent-card:hover {
  border-color: var(--color-primary);
}

.card-header {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.agent-avatar {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-primary-light);
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-md);
  color: var(--color-primary);
  flex-shrink: 0;
}

.builtin-avatar {
  background: rgba(139, 92, 246, 0.1);
  border-color: rgba(139, 92, 246, 0.4);
  color: var(--neon-purple);
}

.agent-meta {
  flex: 1;
  min-width: 0;
}

.agent-meta h4 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.builtin-badge {
  padding: 1px 8px;
  background: rgba(139, 92, 246, 0.1);
  border: 1px solid rgba(139, 92, 246, 0.3);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 10px;
  color: var(--neon-purple);
  letter-spacing: 0.5px;
}

.agent-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-actions {
  display: flex;
  gap: 6px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.agent-card:hover .card-actions {
  opacity: 1;
}

.action-btn {
  width: 32px;
  height: 32px;
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

.action-btn.edit:hover {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

.action-btn.delete:hover {
  border-color: var(--neon-pink);
  color: var(--neon-pink);
  background: rgba(247, 37, 133, 0.1);
}

/* 卡片内容 */
.card-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 12px;
  border-top: 1px solid var(--border-subtle);
}

.info-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.info-label {
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 60px;
  font-size: 12px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.info-value {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tool-tag {
  padding: 2px 10px;
  background: rgba(0, 180, 216, 0.1);
  border: 1px solid rgba(0, 180, 216, 0.25);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--neon-cyan);
}

.trait-tag {
  padding: 2px 10px;
  background: var(--color-primary-light);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--color-primary);
}

.model-tag {
  padding: 2px 10px;
  background: rgba(155, 93, 229, 0.1);
  border: 1px solid rgba(155, 93, 229, 0.25);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--neon-purple);
}

.muted {
  font-size: 12px;
  color: var(--text-muted);
}

/* 提示词折叠 */
.prompt-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.prompt-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  background: none;
  border: none;
  padding: 0;
  font-size: 12px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  cursor: pointer;
}

.prompt-toggle:hover {
  color: var(--text-secondary);
}

.prompt-toggle .rotated {
  transform: rotate(180deg);
}

.prompt-preview {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
  padding-left: 4px;
}

.prompt-content {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  padding: 10px 14px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
  white-space: pre-wrap;
}

/* Modal 按钮 */
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

.modal-btn.submit:hover {
  background: var(--color-primary-hover);
}

.modal-btn.submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* 内置 Agent 编辑警告 */
.builtin-warning {
  margin-bottom: 16px;
  padding: 10px 16px;
  background: rgba(139, 92, 246, 0.08);
  border: 1px solid rgba(139, 92, 246, 0.25);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--neon-purple);
  line-height: 1.5;
}

/* 空状态 */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  text-align: center;
}

.empty-icon {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  color: var(--text-muted);
  margin-bottom: 20px;
}

.empty-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 13px;
  color: var(--text-muted);
}

/* 创建按钮组 */
.create-actions {
  display: flex;
  gap: 8px;
}

.create-btn.template {
  background: rgba(0, 245, 212, 0.1);
  border: 1px solid rgba(0, 245, 212, 0.3);
}

.create-btn.template:hover {
  background: rgba(0, 245, 212, 0.2);
}

/* 复制按钮 */
.action-btn.copy:hover {
  border-color: var(--neon-cyan);
  color: var(--neon-cyan);
}

/* 模板网格 */
.template-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.template-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: left;
}

.template-card:hover {
  border-color: var(--color-primary);
  background: var(--color-primary-light);
}

.template-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.template-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.template-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.template-desc {
  font-size: 12px;
  color: var(--text-muted);
}
</style>
