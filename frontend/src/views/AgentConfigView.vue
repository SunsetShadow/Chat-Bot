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
  ChevronBackOutline,
  AddOutline,
  CreateOutline,
  TrashOutline,
  SparklesOutline,
  BuildOutline,
  ChevronDownOutline,
  CopyOutline,
  FlashOutline,
} from "@vicons/ionicons5";

const router = useRouter();
const agentStore = useAgentStore();
const message = useMessage();
const dialog = useDialog();

function createEmptyForm(): AgentCreate {
  return {
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
}

function agentToFormValues(agent: Agent | AgentTemplate, overrides?: Partial<AgentCreate>): AgentCreate {
  return {
    name: agent.name,
    description: agent.description || "",
    system_prompt: stripLegacyToolHints(agent.system_prompt || ""),
    traits: [...(agent.traits || [])],
    tools: [...(agent.tools || [])],
    skills: [...(('skills' in agent ? agent.skills : []) || [])],
    model_name: ('model_name' in agent ? agent.model_name : undefined) || "",
    capabilities: agent.capabilities || "",
    enabled: 'enabled' in agent ? agent.enabled : true,
    temperature: agent.temperature,
    ...overrides,
  };
}

const availableTools = ref<ToolInfo[]>([]);

const showModal = ref(false);
const editingAgentId = ref<string | null>(null);
const saving = ref(false);

const formValue = ref<AgentCreate>(createEmptyForm());

const editingBuiltin = ref(false);

const showTemplateModal = ref(false);

const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    name: "客服助手",
    description: "专业的客户服务，处理用户咨询和问题",
    system_prompt: `# 角色
你是一个专业的客户服务代表。

# 核心原则
- 耐心倾听用户问题，提供准确、友好的解答
- 优先解决用户问题，不推诿

# 输出规范
- 语气亲切专业，避免机械套话
- 无法解决时主动引导到人工客服，给出联系方式

# 工具使用
- extract_memory：记住用户的历史问题和偏好，提供个性化服务
- knowledge_query：查询常见问题库和产品知识`,
    traits: ["耐心", "专业", "友好"],
    tools: ["extract_memory", "knowledge_query"],
    capabilities: "处理用户咨询、问题排查、服务引导",
    temperature: 0.3,
    icon: "🎧",
  },
  {
    name: "数据分析师",
    description: "数据分析专家，擅长数据解读和可视化建议",
    system_prompt: `# 角色
你是一个数据分析师。

# 核心原则
- 用数据驱动的方式回答问题，结论有据可查
- 注重数据的准确性和可操作性

# 输出规范
- 提供清晰的图表建议（图表类型、维度、交互方式）
- 洞察分析分点呈现，先结论后论据

# 工具使用
- extract_memory：记住用户的数据源、业务指标和分析偏好
- web_search：获取行业基准数据和最新统计信息
- knowledge_query：查询历史分析报告`,
    traits: ["严谨", "数据驱动", "洞察力"],
    tools: ["extract_memory", "web_search", "knowledge_query"],
    capabilities: "数据分析、趋势解读、可视化建议、统计推断",
    temperature: 0.2,
    icon: "📊",
  },
  {
    name: "翻译专家",
    description: "多语言翻译，支持中英日韩等语言",
    system_prompt: `# 角色
你是一个专业的翻译专家，精通中英日韩等多种语言。

# 核心原则
- 翻译准确、自然，保持原文语气和风格
- 尊重文化差异，必要时加注释说明

# 输出规范
- 如有多种译法，说明各自适用场景
- 专业术语首次出现时标注原文
- 长文本分段落翻译，保持格式

# 工具使用
- extract_memory：记住用户偏好的术语翻译和行业词汇表`,
    traits: ["准确", "自然", "多语言"],
    tools: ["extract_memory"],
    capabilities: "多语言翻译、本地化、术语管理",
    temperature: 0.3,
    icon: "🌐",
  },
  {
    name: "创意策划",
    description: "创意策划与头脑风暴，激发灵感",
    system_prompt: `# 角色
你是一个创意策划师，擅长头脑风暴和创新方案设计。

# 核心原则
- 用发散思维探索多种可能性，不设限
- 先发散后收敛，最终给出可执行的方案

# 输出规范
- 方案结构化呈现：核心创意 + 执行路径 + 预期效果
- 创意点用编号列出，方便讨论和取舍

# 工具使用
- web_search：调研竞品案例、行业趋势、热门话题
- extract_memory：记住用户品牌调性、过往偏好和已否决的方案`,
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
  formValue.value = agentToFormValues(template);
  showTemplateModal.value = false;
  showModal.value = true;
}

const toolHintsPreview = computed(() => getToolHints(formValue.value.tools || []));

function duplicateAgent(agent: Agent) {
  formValue.value = agentToFormValues(agent, { name: `${agent.name} (副本)` });
  editingAgentId.value = null;
  editingBuiltin.value = false;
  showModal.value = true;
}

const activeTab = ref("custom");

const expandedAgents = ref<Set<string>>(new Set());

const modalTitle = computed(() =>
  editingAgentId.value ? "编辑 Agent" : "创建 Agent",
);

const customAgents = computed(() =>
  agentStore.agents.filter((a) => !a.is_system),
);

const systemAgents = computed(() =>
  agentStore.agents.filter((a) => a.is_system),
);

const toolOptions = computed(() =>
  availableTools.value.map((t) => ({
    label: t.description ? `${t.name}（${t.description}）` : t.name,
    value: t.name,
  })),
);

function stripLegacyToolHints(prompt: string): string {
  const markers = ["\n\n【可用工具】\n", "\n\n可用工具：\n"];
  for (const m of markers) {
    const idx = prompt.lastIndexOf(m);
    if (idx !== -1) return prompt.slice(0, idx);
  }
  return prompt;
}

function getToolHints(tools: string[]): string {
  const selected = availableTools.value.filter((t) => tools.includes(t.name));
  if (selected.length === 0) return "";
  const lines = selected.map((t, i) => `(${i + 1}) ${t.name}：${t.description}。`);
  return "\n\n【可用工具】\n" + lines.join("\n");
}

function getFullPromptDisplay(agent: Agent): string {
  const base = stripLegacyToolHints(agent.system_prompt || '');
  const toolNames = agent.is_system
    ? availableTools.value.map((t) => t.name)
    : (agent.tools || []);
  return base + getToolHints(toolNames);
}

onMounted(async () => {
  try {
    await agentStore.fetchAgents();
  } catch {
    console.warn("获取 Agent 列表失败");
  }
  try {
    availableTools.value = await getTools();
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
  formValue.value = createEmptyForm();
  showModal.value = true;
}

function openEditModal(agent: Agent) {
  editingAgentId.value = agent.id;
  editingBuiltin.value = agent.is_builtin;
  formValue.value = agentToFormValues(agent);
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
    const payload = { ...formValue.value };
    if (editingAgentId.value) {
      await agentStore.updateAgent(
        editingAgentId.value,
        payload as AgentUpdate,
      );
      message.success("Agent 更新成功");
    } else {
      await agentStore.createAgent(payload);
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
  <div class="agent-config-view" :class="{ embedded }">
    <!-- Tabs -->
    <div class="agent-tab-bar">
      <NTabs v-model:value="activeTab" type="segment" size="small">
        <NTabPane name="custom" tab="自定义 Agent" />
        <NTabPane name="system" tab="系统 Agent" />
      </NTabs>
    </div>

    <!-- 自定义 Agent -->
    <div v-show="activeTab === 'custom'" class="agent-list-content">
      <div class="tab-actions">
        <button class="btn-outline btn-sm" @click="openTemplateModal">
          <NIcon :component="FlashOutline" :size="14" />
          <span>模板创建</span>
        </button>
        <button class="btn-primary btn-sm" @click="openCreateModal">
          <NIcon :component="AddOutline" :size="14" />
          <span>空白创建</span>
        </button>
      </div>
      <NSpin :show="agentStore.isLoading">
        <div v-if="customAgents.length > 0" class="agent-cards">
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
                <h4>
                  {{ agent.name }}
                  <span v-if="agent.is_builtin" class="builtin-badge">示例</span>
                  <span class="role-badge sub-agent-badge">子Agent</span>
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
                <button
                  class="action-btn delete"
                  title="删除"
                  @click="handleDelete(agent.id)"
                >
                  <NIcon :component="TrashOutline" :size="16" />
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
                  <span v-if="!agent.tools?.length" class="muted">无</span>
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
                  {{ getFullPromptDisplay(agent) }}
                </div>
                <div v-else class="prompt-preview">
                  {{ truncatePrompt(getFullPromptDisplay(agent)) }}
                </div>
              </div>

              <div v-if="agent.model_name" class="info-row">
                <span class="info-label">模型</span>
                <span class="model-tag">{{ agent.model_name }}</span>
              </div>
            </div>
          </div>
        </div>

        <div
          v-else-if="!agentStore.isLoading"
          class="empty-state"
        >
          <div class="empty-icon">
            <NIcon :component="SparklesOutline" :size="48" />
          </div>
          <p class="empty-title">暂无自定义 Agent</p>
          <p class="empty-hint">点击上方按钮创建</p>
        </div>
      </NSpin>
    </div>

    <!-- 系统 Agent -->
    <div v-show="activeTab === 'system'" class="agent-list-content">
      <NSpin :show="agentStore.isLoading">
        <div v-if="systemAgents.length > 0" class="agent-cards">
          <div
            v-for="agent in systemAgents"
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
                  <span class="builtin-badge">系统</span>
                  <span v-if="agent.id === 'ani'" class="role-badge supervisor-badge">Supervisor</span>
                  <span v-else class="role-badge sub-agent-badge">子Agent</span>
                </h4>
                <span class="agent-desc">{{ agent.description }}</span>
              </div>
            </div>
            <div class="card-body">
              <div
                v-if="agent.id === 'ani' || agent.id === 'builtin-job-executor'"
                class="system-note"
              >
                永久拥有所有工具和所有子 Agent 的调用权限，不可修改。
              </div>
              <div class="info-row">
                <span class="info-label">
                  <NIcon :component="BuildOutline" :size="14" />
                  工具
                </span>
                <div class="info-value">
                  <span class="tool-tag">全部工具</span>
                </div>
              </div>
              <div class="info-row">
                <span class="info-label">特征</span>
                <div class="info-value">
                  <span v-for="trait in agent.traits" :key="trait" class="trait-tag">{{ trait }}</span>
                </div>
              </div>
              <div class="prompt-row">
                <button class="prompt-toggle" @click="toggleExpand(agent.id)">
                  <span>系统提示词</span>
                  <NIcon :component="ChevronDownOutline" :size="14" :class="{ rotated: expandedAgents.has(agent.id) }" />
                </button>
                <div v-if="expandedAgents.has(agent.id)" class="prompt-content">{{ getFullPromptDisplay(agent) }}</div>
                <div v-else class="prompt-preview">{{ truncatePrompt(getFullPromptDisplay(agent)) }}</div>
              </div>
            </div>
          </div>
        </div>
      </NSpin>
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
          <div class="prompt-editor-area">
            <NInput
              v-model:value="formValue.system_prompt"
              type="textarea"
              :rows="5"
              placeholder="# 角色&#10;描述这个 Agent 的身份和能力&#10;&#10;# 核心原则&#10;关键行为准则&#10;&#10;# 输出规范&#10;格式、语言风格、长度要求"
            />
            <div v-if="toolHintsPreview" class="prompt-tool-hints">
              <span class="prompt-tool-hints-label">以上为自定义提示词，以下根据已选工具自动生成</span>
              <div class="prompt-tool-hints-content">{{ toolHintsPreview.trim() }}</div>
            </div>
          </div>
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
            :disabled="!availableTools.length"
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
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  height: 100vh;
}

.agent-config-view.embedded {
  height: 100%;
  padding: 0;
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

.header-actions {
  display: flex;
  gap: 8px;
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

.btn-outline {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  background: transparent;
  border: 1px solid var(--color-primary);
  border-radius: var(--radius-sm);
  color: var(--color-primary);
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.btn-outline:hover {
  background: var(--color-primary-light);
}

.btn-sm {
  padding: 7px 14px;
  font-size: 12px;
}

/* === Embedded Toolbar === */
.embedded-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 0 8px 0;
}

/* === Agent 列表 === */
.agent-list-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 20px;
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

.role-badge {
  padding: 1px 8px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.5px;
}

.supervisor-badge {
  background: rgba(0, 245, 212, 0.1);
  border: 1px solid rgba(0, 245, 212, 0.3);
  color: var(--neon-cyan);
}

:root:not(.dark) .supervisor-badge {
  color: #0891b2;
  border-color: rgba(6, 182, 212, 0.3);
}

.sub-agent-badge {
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.2);
  color: var(--color-primary);
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

.action-btn.copy:hover {
  border-color: var(--neon-cyan);
  color: var(--neon-cyan);
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

:root.dark .modal-btn.submit {
  color: var(--text-inverse);
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

/* === Tab Bar === */
.agent-tab-bar {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.tab-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 4px 12px 0;
}

/* 系统权限提示 */
.system-note {
  padding: 8px 14px;
  background: rgba(0, 245, 212, 0.06);
  border: 1px solid rgba(0, 245, 212, 0.2);
  border-radius: var(--radius-sm);
  font-size: 12px;
  color: var(--neon-cyan);
  line-height: 1.5;
}

:root:not(.dark) .system-note {
  color: #0891b2;
  border-color: rgba(6, 182, 212, 0.25);
  background: rgba(6, 182, 212, 0.06);
}

.prompt-editor-area {
  width: 100%;
}

.prompt-tool-hints {
  margin-top: 6px;
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.prompt-tool-hints-label {
  display: block;
  padding: 4px 12px;
  font-size: 10px;
  font-family: var(--font-mono);
  color: var(--text-muted);
  background: var(--bg-tertiary);
  border-bottom: 1px dashed var(--border-color);
}

.prompt-tool-hints-content {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.6;
  padding: 8px 12px;
  white-space: pre-wrap;
  font-family: var(--font-mono);
}
</style>
