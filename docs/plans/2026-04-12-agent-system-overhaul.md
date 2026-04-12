# Agent 系统全面重构 - 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复 Agent 配置页面 bug，完善 Agent 系统，增加 Agent 间协作、工具权限、HITL 等能力

**Architecture:** Supervisor 多 Agent 架构（已有）+ Agent 间委托工具 + LangGraph interrupt 实现 HITL

**Tech Stack:** NestJS 11 + LangGraph 1.2 + Vue 3.5 + AI SDK 6 + Naive UI + Tailwind CSS 4

---

## 文件结构

### 阶段 1：Bug 修复 + 配置页面

| 操作 | 文件 | 职责 |
|------|------|------|
| 修改 | `frontend/src/views/AgentConfigView.vue` | 修复 Modal + UI 改进 |
| 修改 | `frontend/src/stores/agent.ts` | 错误处理改进 |
| 修改 | `frontend/src/types/index.ts` | 新增 AgentTemplate 类型 |
| 删除 | `frontend/src/components/agent/AgentEditor.vue` | 冗余组件 |
| 删除 | `backend/src/modules/llm/` | 死代码（3 个文件） |

### 阶段 2：Agent 协作 + 工具系统

| 操作 | 文件 | 职责 |
|------|------|------|
| 修改 | `backend/src/modules/langgraph/graph/supervisor.builder.ts` | 路由优化 |
| 创建 | `backend/src/modules/langgraph/tools/delegate-to-agent.tool.ts` | Agent 间委托 |
| 修改 | `backend/src/modules/langgraph/langgraph.service.ts` | 委托事件 + HITL |
| 修改 | `backend/src/modules/langgraph/tools/web-search.tool.ts` | 实现搜索 |
| 修改 | `backend/src/modules/langgraph/tools/tool-registry.service.ts` | 权限分级 |
| 修改 | `backend/src/modules/langgraph/tools/index.ts` | 导出新工具 |
| 修改 | `backend/src/modules/langgraph/langgraph.module.ts` | 注册新工具 |
| 修改 | `backend/src/common/entities/agent.entity.ts` | 新增字段 |
| 修改 | `frontend/src/composables/useChatTransport.ts` | 委托事件处理 |
| 修改 | `frontend/src/types/index.ts` | 新增类型 |

### 阶段 3：聊天体验增强

| 操作 | 文件 | 职责 |
|------|------|------|
| 修改 | `frontend/src/components/chat/AgentIndicator.vue` | 实时 Agent 指示 |
| 创建 | `frontend/src/components/chat/AgentCollaborationView.vue` | 协作可视化 |
| 修改 | `frontend/src/composables/useAIChat.ts` | Agent 切换逻辑 |
| 修改 | `frontend/src/components/chat/ChatContainer.vue` | Agent 选择器 |
| 修改 | `frontend/src/components/common/AppHeader.vue` | 导航更新 |

---

## 阶段 1：Bug 修复 + 配置页面完善

### Task 1: 修复 AgentConfigView Modal 弹窗

**Files:**
- Modify: `frontend/src/views/AgentConfigView.vue:77-85`

- [ ] **Step 1: 修复 onMounted 错误处理**

`onMounted` 中 `agentStore.fetchAgents()` 没有 try-catch，API 失败时会抛出未捕获异常，可能中断组件渲染。

将 `onMounted` 改为：

```typescript
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
```

- [ ] **Step 2: 验证后端端口配置**

检查 `backend/.env` 或 NestJS 启动端口是否与前端 `API_BASE_URL` 匹配：
- 后端 NestJS 默认端口：3001（检查 `backend/src/main.ts`）
- 前端 `API_BASE_URL` 默认：`http://localhost:8000`
- Vite proxy 配置：`/api` → `http://localhost:8000`

如果后端在 3001，需要设置 `frontend/.env`：
```
VITE_API_BASE_URL=http://localhost:3001
```

或者修改 `backend/src/main.ts` 使端口为 8000。

- [ ] **Step 3: 启动前后端验证**

```bash
cd backend && pnpm dev     # 启动后端
cd frontend && pnpm dev    # 启动前端
```

在浏览器访问 `http://localhost:3000/agentconfig`，验证：
1. Agent 列表正常显示
2. 点击「创建 Agent」按钮 Modal 弹窗正常弹出
3. 点击 Agent 卡片的编辑按钮 Modal 弹窗正常弹出

- [ ] **Step 4: 提交**

```bash
git add frontend/src/views/AgentConfigView.vue
git commit -m "fix: 修复 AgentConfigView Modal 弹窗无法打开的问题"
```

---

### Task 2: 配置页面 UI 改进 — 表单校验与 Toast 提示

**Files:**
- Modify: `frontend/src/views/AgentConfigView.vue`

- [ ] **Step 1: 添加 useMessage 引入**

在 `<script setup>` 顶部添加 Naive UI 的 `useMessage`：

```typescript
import { useMessage } from "naive-ui";

const message = useMessage();
```

注意：`useMessage` 需要在 Naive UI 的 `NMessageProvider` 内使用。检查 `App.vue` 或根组件是否已包裹 `NMessageProvider`。如果没有，需要添加。

- [ ] **Step 2: 改进 handleSubmit 函数**

替换现有的 `handleSubmit` 函数，添加校验和 Toast 提示：

```typescript
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
      await agentStore.updateAgent(editingAgentId.value, formValue.value as AgentUpdate);
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
```

- [ ] **Step 3: 改进 handleDelete 添加确认弹窗**

替换 `handleDelete`，添加确认对话框：

```typescript
import { useDialog } from "naive-ui";

const dialog = useDialog();

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
```

注意：`useDialog` 同样需要在 `NDialogProvider` 内使用。

- [ ] **Step 4: 添加 NFormItem 的 validation-status**

为必填字段添加验证状态显示：

```html
<NFormItem label="名称" required :validation-status="formValue.name ? undefined : 'error'" :feedback="formValue.name ? undefined : '名称不能为空'">
  <NInput
    v-model:value="formValue.name"
    placeholder="输入 Agent 名称"
    :disabled="editingBuiltin"
  />
</NFormItem>
```

- [ ] **Step 5: 验证**

启动前后端，测试：
1. 创建空名称的 Agent → 显示警告
2. 创建成功 → 显示成功 Toast
3. 删除 Agent → 弹出确认对话框 → 确认后删除
4. API 失败场景 → 显示错误 Toast

- [ ] **Step 6: 提交**

```bash
git add frontend/src/views/AgentConfigView.vue
git commit -m "feat: Agent 配置页面添加表单校验和 Toast 提示"
```

---

### Task 3: 添加复制 Agent 和 Agent 模板预设

**Files:**
- Modify: `frontend/src/views/AgentConfigView.vue`
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: 在 types/index.ts 添加 AgentTemplate 类型**

```typescript
// Agent 模板预设
export interface AgentTemplate {
  name: string;
  description: string;
  system_prompt: string;
  traits: string[];
  tools: string[];
  capabilities: string;
  temperature: number;
  icon: string; // emoji
}
```

- [ ] **Step 2: 在 AgentConfigView 添加内置模板数据**

```typescript
const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    name: "客服助手",
    description: "专业的客户服务，处理用户咨询和问题",
    system_prompt: "你是一个专业的客户服务代表。请耐心倾听用户问题，提供准确、友好的解答。遇到无法解决的问题，请建议用户联系人工客服。",
    traits: ["耐心", "专业", "友好"],
    tools: ["extract_memory", "knowledge_query"],
    capabilities: "处理用户咨询、问题排查、服务引导",
    temperature: 0.3,
    icon: "🎧",
  },
  {
    name: "数据分析师",
    description: "数据分析专家，擅长数据解读和可视化建议",
    system_prompt: "你是一个数据分析师。请用数据驱动的方式回答问题，提供清晰的图表建议和洞察分析。注重数据的准确性和可操作性。",
    traits: ["严谨", "数据驱动", "洞察力"],
    tools: ["extract_memory", "web_search", "knowledge_query"],
    capabilities: "数据分析、趋势解读、可视化建议、统计推断",
    temperature: 0.2,
    icon: "📊",
  },
  {
    name: "翻译专家",
    description: "多语言翻译，支持中英日韩等语言",
    system_prompt: "你是一个专业的翻译专家。请提供准确、自然的翻译，保持原文的语气和风格。如有多种译法，请说明差异。",
    traits: ["准确", "自然", "多语言"],
    tools: ["extract_memory"],
    capabilities: "多语言翻译、本地化、术语管理",
    temperature: 0.3,
    icon: "🌐",
  },
  {
    name: "创意策划",
    description: "创意策划与头脑风暴，激发灵感",
    system_prompt: "你是一个创意策划师。请用发散思维帮助用户头脑风暴，提供新颖独特的创意方案。不设限，鼓励大胆想象。",
    traits: ["创意", "发散思维", "有趣"],
    tools: ["extract_memory", "web_search"],
    capabilities: "创意策划、头脑风暴、方案设计、灵感激发",
    temperature: 1.2,
    icon: "💡",
  },
];
```

- [ ] **Step 3: 添加模板选择和复制 Agent 功能**

在 `AgentConfigView.vue` 的 script 中添加：

```typescript
import { CopyOutline, FlashOutline } from "@vicons/ionicons5";

const showTemplateModal = ref(false);

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
```

- [ ] **Step 4: 在 Agent 卡片添加复制按钮**

在 Agent 卡片的 `card-actions` 区域，为每个 Agent 添加复制按钮：

```html
<div class="card-actions">
  <button
    class="action-btn edit"
    title="编辑"
    @click="openEditModal(agent)"
  >
    <NIcon :component="CreateOutline" :size="16" />
  </button>
  <button
    class="action-btn"
    title="复制"
    style="color: var(--neon-cyan)"
    @click="duplicateAgent(agent)"
  >
    <NIcon :component="CopyOutline" :size="16" />
  </button>
  <button
    v-if="!agent.is_builtin"
    class="action-btn delete"
    title="删除"
    @click="handleDelete(agent.id)"
  >
    <NIcon :component="TrashOutline" :size="16" />
  </button>
</div>
```

- [ ] **Step 5: 添加模板选择 Modal**

在 `AgentConfigView.vue` 的 template 末尾添加模板选择弹窗：

```html
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
```

添加对应的 CSS：

```css
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
```

- [ ] **Step 6: 修改创建按钮，增加模板入口**

将 header 的创建按钮改为下拉式：

```html
<div class="create-actions">
  <button class="create-btn" @click="openTemplateModal">
    <NIcon :component="FlashOutline" :size="18" />
    <span>从模板创建</span>
  </button>
  <button class="create-btn" @click="openCreateModal">
    <NIcon :component="AddOutline" :size="18" />
    <span>空白创建</span>
  </button>
</div>
```

对应 CSS：
```css
.create-actions {
  display: flex;
  gap: 8px;
}
```

- [ ] **Step 7: 验证**

1. 点击「从模板创建」→ 弹出模板列表 → 选择模板 → 弹出编辑框且预填充模板数据
2. 点击 Agent 卡片的复制按钮 → 弹出编辑框且预填充 Agent 数据（名称带"副本"后缀）
3. 提交创建 → 成功 Toast → 新 Agent 出现在列表中

- [ ] **Step 8: 提交**

```bash
git add frontend/src/views/AgentConfigView.vue frontend/src/types/index.ts
git commit -m "feat: Agent 配置页面添加模板预设和复制 Agent 功能"
```

---

### Task 4: 检查并修复 Naive UI Provider 配置

**Files:**
- Modify: `frontend/src/App.vue`（如需）

- [ ] **Step 1: 检查 App.vue 是否有 NMessageProvider 和 NDialogProvider**

读取 `App.vue`，检查是否包含：

```html
<NMessageProvider>
  <NDialogProvider>
    <RouterView />
  </NDialogProvider>
</NMessageProvider>
```

如果没有，需要添加。`useMessage` 和 `useDialog` 必须在对应的 Provider 内才能使用。

- [ ] **Step 2: 如果缺少 Provider，添加配置**

在 `App.vue` 中包裹 RouterView：

```html
<NConfigProvider>
  <NMessageProvider>
    <NDialogProvider>
      <RouterView />
    </NDialogProvider>
  </NMessageProvider>
</NConfigProvider>
```

注意导入 `NConfigProvider`、`NMessageProvider`、`NDialogProvider`（auto-import 会自动处理）。

- [ ] **Step 3: 验证**

重启前端，确认页面正常渲染，Agent 配置页面的 Toast 和 Dialog 能正常显示。

- [ ] **Step 4: 提交**

```bash
git add frontend/src/App.vue
git commit -m "fix: 添加 Naive UI Provider 支持 useMessage 和 useDialog"
```

---

### Task 5: 清理死代码

**Files:**
- Delete: `frontend/src/components/agent/AgentEditor.vue`
- Delete: `backend/src/modules/llm/llm.module.ts`
- Delete: `backend/src/modules/llm/llm.service.ts`
- Delete: `backend/src/modules/llm/providers/base.provider.ts`
- Delete: `backend/src/modules/llm/providers/openai.provider.ts`

- [ ] **Step 1: 确认 AgentEditor.vue 无引用**

搜索项目中是否有其他文件 import 了 `AgentEditor.vue`：

```bash
grep -r "AgentEditor" frontend/src/ --include="*.vue" --include="*.ts"
```

如果没有引用，可以安全删除。

- [ ] **Step 2: 确认 llm 模块无引用**

```bash
grep -r "from.*llm" backend/src/ --include="*.ts" | grep -v node_modules
grep -r "LlmModule\|LlmService" backend/src/ --include="*.ts"
```

如果没有引用（除了 llm 模块内部），可以安全删除。

- [ ] **Step 3: 删除文件**

```bash
rm frontend/src/components/agent/AgentEditor.vue
rm -rf backend/src/modules/llm/
```

- [ ] **Step 4: 清理 components.d.ts 中的 AgentEditor 声明**

编辑 `frontend/src/components.d.ts`，移除 AgentEditor 行（如果有）。注意这是 auto-generated 文件，重启 dev server 后会自动重新生成。

- [ ] **Step 5: 验证**

```bash
cd backend && pnpm build    # 确认后端编译通过
cd frontend && pnpm build   # 确认前端编译通过
```

- [ ] **Step 6: 提交**

```bash
git add -A
git commit -m "chore: 移除未使用的 AgentEditor 组件和 llm 模块死代码"
```

---

## 阶段 2：Agent 协作机制 + 工具系统

### Task 6: Agent 实体新增字段

**Files:**
- Modify: `backend/src/common/entities/agent.entity.ts`
- Modify: `frontend/src/types/index.ts`
- Modify: `backend/src/modules/agent/dto/create-agent.dto.ts`
- Modify: `backend/src/modules/agent/dto/update-agent.dto.ts`

- [ ] **Step 1: 后端 AgentEntity 新增字段**

```typescript
// 在 agent.entity.ts 中新增：
@Column({ nullable: true })
avatar: string;

@Column({ nullable: true })
category: string;

@Column({ nullable: true })
max_turns: number;

@Column('simple-array', { default: '' })
handoff_targets: string[];
```

- [ ] **Step 2: 前端类型同步更新**

在 `types/index.ts` 的 Agent 接口添加：

```typescript
avatar?: string;
category?: string;
max_turns?: number;
handoff_targets?: string[];
```

在 AgentCreate 和 AgentUpdate 中添加对应可选字段。

- [ ] **Step 3: DTO 更新**

在 `create-agent.dto.ts` 和 `update-agent.dto.ts` 中添加：

```typescript
@IsString()
@IsOptional()
avatar?: string;

@IsString()
@IsOptional()
category?: string;

@IsNumber()
@IsOptional()
max_turns?: number;

@IsArray()
@IsString({ each: true })
@IsOptional()
handoff_targets?: string[];
```

- [ ] **Step 4: 验证并提交**

```bash
cd backend && pnpm build
git add -A
git commit -m "feat: Agent 实体新增 avatar、category、max_turns、handoff_targets 字段"
```

---

### Task 7: Agent 间委托工具

**Files:**
- Create: `backend/src/modules/langgraph/tools/delegate-to-agent.tool.ts`
- Modify: `backend/src/modules/langgraph/tools/index.ts`
- Modify: `backend/src/modules/langgraph/langgraph.module.ts`

- [ ] **Step 1: 创建 delegate-to-agent.tool.ts**

```typescript
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

export function createDelegateToAgentTool(
  agentLookup: (id: string) => { name: string; capabilities: string } | undefined,
) {
  return new DynamicStructuredTool({
    name: 'delegate_to_agent',
    description:
      '将当前任务委托给另一个更专业的 Agent 处理。仅在当前 Agent 无法很好处理用户请求时使用。',
    schema: z.object({
      agent_id: z.string().describe('目标 Agent 的 ID'),
      task: z.string().describe('需要委托的任务描述'),
      context: z.string().optional().describe('传递给目标 Agent 的上下文信息'),
    }),
    func: async ({ agent_id, task, context }) => {
      const target = agentLookup(agent_id);
      if (!target) {
        return `错误：找不到 Agent "${agent_id}"`;
      }
      // 返回委托信号，由 LangGraphService 在流中处理
      return JSON.stringify({
        __delegation__: true,
        target_agent: agent_id,
        task,
        context: context || '',
      });
    },
  });
}
```

- [ ] **Step 2: 更新 tools/index.ts 导出**

```typescript
export { createDelegateToAgentTool } from './delegate-to-agent.tool';
```

- [ ] **Step 3: 在 LangGraphModule 中注册工具**

在 `langgraph.module.ts` 的 `onModuleInit` 中添加：

```typescript
import { createDelegateToAgentTool } from './tools/delegate-to-agent.tool';

// 在 onModuleInit 中：
this.toolRegistry.register(
  createDelegateToAgentTool((id) => {
    // 同步查找 agent（需要注意异步转同步的问题）
    // 改为在注册时传入 agent 信息
    return undefined; // 占位，实际实现需要调整
  }),
);
```

注意：由于 `DynamicStructuredTool` 的 func 是同步回调但需要访问异步的 AgentService，需要在初始化时获取 agent 列表并缓存。具体实现可以在 `LangGraphService.rebuildSupervisorGraph()` 时同步更新工具。

- [ ] **Step 4: 在 LangGraphService 中处理委托输出**

修改 `chatStream` 方法，在检测到 `__delegation__` 标记时 yield `delegation` 事件：

```typescript
// 在 tool_output 处理中添加委托检测
if (isTool) {
  const output = typeof (message as any).content === 'string'
    ? (message as any).content
    : JSON.stringify((message as any).content);

  // 检测委托信号
  try {
    const parsed = JSON.parse(output);
    if (parsed.__delegation__) {
      yield {
        type: 'agent_switched' as any,
        fromAgent: currentAgent,
        toAgent: parsed.target_agent,
      } as StreamEvent;
    }
  } catch {}

  yield { type: 'tool_output', toolCallId, output };
  sawToolOutput = true;
}
```

- [ ] **Step 5: 验证并提交**

```bash
cd backend && pnpm build
git add -A
git commit -m "feat: 添加 Agent 间委托工具 delegate_to_agent"
```

---

### Task 8: Supervisor 路由优化

**Files:**
- Modify: `backend/src/modules/langgraph/graph/supervisor.builder.ts`

- [ ] **Step 1: 改进 Supervisor prompt**

替换 `supervisor.builder.ts` 中的 supervisor prompt：

```typescript
const supervisor = createSupervisor({
  agents: workerAgents as any,
  llm: model,
  prompt: `你是一个智能任务调度器。分析用户请求，将其分配给最合适的专业 AI 助手。

可用助手及其专业领域：
${agentDescriptions}
${preferenceHint}

调度规则：
1. 仔细分析用户意图和请求类型
2. 根据每个助手的专业能力匹配最合适的人选
3. 如果用户指定了偏好助手，且请求适合该助手，请优先选择
4. 对于模糊请求，选择能力范围最广的通用助手
5. 复杂的多步骤任务可以拆分后分步处理
6. 直接调用助手，不要解释你的选择理由

示例匹配：
- "帮我写一段 Python 代码" → 编程专家
- "翻译这段话" → 翻译专家（如果有）
- "分析这组数据" → 数据分析师（如果有）
- 日常闲聊或综合问题 → 通用助手`,
  outputMode: 'last_message',
  addHandoffBackMessages: true,
  supervisorName: 'supervisor',
});
```

- [ ] **Step 2: 验证**

启动后端，发送不同类型的消息，验证路由是否正确。

- [ ] **Step 3: 提交**

```bash
git add backend/src/modules/langgraph/graph/supervisor.builder.ts
git commit -m "feat: 优化 Supervisor 路由 prompt，增加 few-shot 示例"
```

---

### Task 9: 工具权限分级

**Files:**
- Modify: `backend/src/modules/langgraph/tools/tool-registry.service.ts`
- Modify: `backend/src/modules/langgraph/tools/tool.controller.ts`
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: 扩展 ToolInfo 类型**

在 `frontend/src/types/index.ts` 中修改 ToolInfo：

```typescript
export type ToolPermission = 'read' | 'write' | 'confirm';

export interface ToolInfo {
  name: string;
  description: string;
  permission_level: ToolPermission;
  category: string;
}
```

- [ ] **Step 2: 扩展后端 ToolRegistryService**

在 `tool-registry.service.ts` 中添加权限和分类：

```typescript
export interface ToolMetadata {
  name: string;
  description: string;
  permission_level: 'read' | 'write' | 'confirm';
  category: string;
}

export class ToolRegistryService {
  private tools = new Map<string, DynamicStructuredTool>();
  private metadata = new Map<string, ToolMetadata>();

  register(tool: DynamicStructuredTool, meta?: Partial<ToolMetadata>) {
    this.tools.set(tool.name, tool);
    this.metadata.set(tool.name, {
      name: tool.name,
      description: tool.description || meta?.description || '',
      permission_level: meta?.permission_level || 'read',
      category: meta?.category || 'general',
    });
  }

  get(name: string): DynamicStructuredTool | undefined {
    return this.tools.get(name);
  }

  getAll(): DynamicStructuredTool[] {
    return Array.from(this.tools.values());
  }

  getAllMetadata(): ToolMetadata[] {
    return Array.from(this.metadata.values());
  }
}
```

- [ ] **Step 3: 注册工具时声明权限**

在 `langgraph.module.ts` 的 `onModuleInit` 中：

```typescript
this.toolRegistry.register(createMemoryExtractTool(this.memoryService), {
  permission_level: 'write',
  category: 'memory',
});

this.toolRegistry.register(createKnowledgeQueryTool(this.memoryService), {
  permission_level: 'read',
  category: 'memory',
});

this.toolRegistry.register(createWebSearchTool(), {
  permission_level: 'read',
  category: 'search',
});

this.toolRegistry.register(createDelegateToAgentTool(...), {
  permission_level: 'read',
  category: 'orchestration',
});
```

- [ ] **Step 4: 更新 ToolController**

修改 `tool.controller.ts`，返回 metadata：

```typescript
@Get()
async listTools() {
  return this.toolRegistry.getAllMetadata();
}
```

- [ ] **Step 5: 验证并提交**

```bash
cd backend && pnpm build
git add -A
git commit -m "feat: 工具系统添加权限分级和分类"
```

---

### Task 10: 前端处理委托事件

**Files:**
- Modify: `frontend/src/composables/useChatTransport.ts`
- Modify: `frontend/src/composables/useAIChat.ts`

- [ ] **Step 1: 在 useChatTransport 中处理 agent_switched**

已在现有代码中处理 `agent_switched` 事件。确认 `onAgentSwitched` 回调正确传递。

- [ ] **Step 2: 在 useAIChat 中添加 agent 切换状态**

```typescript
const activeAgentName = ref<string>('');

function handleAgentSwitched(from: string, to: string) {
  activeAgentName.value = to;
}
```

- [ ] **Step 3: 验证**

发送需要特定 Agent 的消息，观察 Agent 指示器是否正确切换。

- [ ] **Step 4: 提交**

```bash
git add frontend/src/composables/useChatTransport.ts frontend/src/composables/useAIChat.ts
git commit -m "feat: 前端处理 Agent 切换和委托事件"
```

---

## 阶段 3：聊天体验增强

### Task 11: 完善 Agent 实时指示器

**Files:**
- Modify: `frontend/src/components/chat/AgentIndicator.vue`
- Modify: `frontend/src/components/chat/ChatContainer.vue`

- [ ] **Step 1: 增强 AgentIndicator 组件**

```vue
<script setup lang="ts">
import { computed } from "vue";
import { useAgentStore } from "@/stores/agent";
import { SparklesOutline } from "@vicons/ionicons5";

const agentStore = useAgentStore();

const props = defineProps<{
  agentId: string;
}>();

const agent = computed(() =>
  agentStore.agents.find((a) => a.id === props.agentId),
);

const displayName = computed(() => agent.value?.name || props.agentId);
const displayIcon = computed(() => agent.value?.avatar || "✨");
</script>

<template>
  <div v-if="agentId" class="agent-indicator">
    <div class="indicator-dot"></div>
    <span class="indicator-icon">{{ displayIcon }}</span>
    <span class="indicator-name">{{ displayName }}</span>
  </div>
</template>

<style scoped>
.agent-indicator {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: var(--color-primary-light);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 20px;
  font-size: 12px;
  color: var(--color-primary);
  animation: fadeIn 0.3s ease-out;
}

.indicator-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--neon-green);
  animation: pulse 2s infinite;
}

.indicator-icon {
  font-size: 14px;
}

.indicator-name {
  font-family: var(--font-mono);
  font-weight: 500;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>
```

- [ ] **Step 2: 在 ChatContainer 中集成 AgentIndicator**

在消息输入框上方添加 Agent 指示器：

```html
<AgentIndicator v-if="activeAgentId" :agent-id="activeAgentId" />
```

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/chat/AgentIndicator.vue frontend/src/components/chat/ChatContainer.vue
git commit -m "feat: 增强 Agent 实时指示器，显示头像和名称"
```

---

### Task 12: 添加 Agent 选择器到聊天界面

**Files:**
- Modify: `frontend/src/components/chat/ChatContainer.vue`
- Modify: `frontend/src/composables/useAIChat.ts`

- [ ] **Step 1: 在 ChatContainer 添加 Agent 选择下拉框**

在消息输入区域上方添加 Agent 选择器：

```html
<div class="agent-selector-bar">
  <span class="selector-label">当前 Agent：</span>
  <select
    v-model="selectedAgentId"
    class="agent-select"
    @change="onAgentChange"
  >
    <option value="">自动选择（Supervisor）</option>
    <option
      v-for="agent in enabledAgents"
      :key="agent.id"
      :value="agent.id"
    >
      {{ agent.avatar || "✨" }} {{ agent.name }}
    </option>
  </select>
</div>
```

- [ ] **Step 2: 添加脚本逻辑**

```typescript
const agentStore = useAgentStore();
const selectedAgentId = ref<string>("");

const enabledAgents = computed(() =>
  agentStore.agents.filter((a) => a.enabled),
);

function onAgentChange() {
  // 将选择的 Agent ID 传递给 useAIChat
  setActiveAgent(selectedAgentId.value || undefined);
}
```

- [ ] **Step 3: 样式**

```css
.agent-selector-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-sm);
}

.selector-label {
  font-size: 12px;
  color: var(--text-muted);
  font-family: var(--font-mono);
}

.agent-select {
  flex: 1;
  padding: 4px 8px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  color: var(--text-primary);
  font-size: 13px;
  outline: none;
}
```

- [ ] **Step 4: 在 useAIChat 中支持 agent_id**

确保 `sendMessage` 时将 `agent_id` 包含在请求体中：

```typescript
const extraBody = computed(() => {
  const body: Record<string, unknown> = {};
  if (selectedAgentId.value) {
    body.agent_id = selectedAgentId.value;
  }
  return body;
});
```

- [ ] **Step 5: 提交**

```bash
git add frontend/src/components/chat/ChatContainer.vue frontend/src/composables/useAIChat.ts
git commit -m "feat: 聊天界面添加 Agent 选择器"
```

---

### Task 13: 最终集成验证

- [ ] **Step 1: 启动前后端**

```bash
./dev.sh
```

- [ ] **Step 2: 验证阶段 1 功能**

1. 访问 `/agentconfig` → Agent 列表正常显示
2. 点击「空白创建」→ Modal 弹出 → 填写表单 → 创建成功
3. 点击「从模板创建」→ 选择模板 → 预填充 → 创建成功
4. 编辑 Agent → 修改信息 → 保存成功
5. 复制 Agent → 创建副本成功
6. 删除 Agent → 确认弹窗 → 删除成功
7. 编译无错误

- [ ] **Step 3: 验证阶段 2 功能**

1. 创建 3+ 个 Agent → 多 Agent 协作状态显示"已启用"
2. 发送消息 → Supervisor 路由到正确的 Agent
3. 工具调用正常工作
4. API `/api/v1/tools` 返回带权限信息的工具列表

- [ ] **Step 4: 验证阶段 3 功能**

1. Agent 选择器正常工作
2. 选择不同 Agent 后消息路由正确
3. 自动选择模式 Supervisor 正常路由
4. Agent 指示器正确显示当前活跃 Agent

- [ ] **Step 5: 前端构建验证**

```bash
cd frontend && pnpm build
cd frontend && pnpm lint
```

- [ ] **Step 6: 后端构建验证**

```bash
cd backend && pnpm build
cd backend && pnpm lint
```
