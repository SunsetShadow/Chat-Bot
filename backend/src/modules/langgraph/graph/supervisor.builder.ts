import { MemorySaver } from '@langchain/langgraph';
import { createReactAgent } from '@langchain/langgraph/prebuilt';
import { createSupervisor } from '@langchain/langgraph-supervisor';
import { ChatOpenAI } from '@langchain/openai';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { CompiledStateGraph } from '@langchain/langgraph';

export interface AgentDefinition {
  id: string;
  name: string;
  system_prompt: string;
  capabilities: string;
  tools: string[];
  model_name?: string;
  temperature?: number;
  enabled: boolean;
}

/**
 * 构建多 Agent Supervisor 图
 *
 * 架构：supervisor → [worker_A | worker_B | ...] → supervisor → ... → END
 * - supervisor 根据 capabilities 描述将任务分配给最合适的 worker agent
 * - 每个 worker agent 有独立的 system prompt、工具集、可选模型
 * - 支持 preferredAgent 偏好提示
 */
export function buildSupervisorGraph(
  model: ChatOpenAI,
  agentDefinitions: AgentDefinition[],
  toolLookup: (name: string) => DynamicStructuredTool | undefined,
  modelFactory?: (modelName: string) => ChatOpenAI,
): CompiledStateGraph<any, any, any> {
  const checkpointer = new MemorySaver();

  // 过滤启用的 Agent
  const enabledAgents = agentDefinitions.filter((d) => d.enabled);
  if (enabledAgents.length === 0) {
    throw new Error('No enabled agents available for supervisor');
  }

  // 为每个 agent 定义创建一个 React Agent
  const workerAgents = enabledAgents.map((def) => {
    const agentTools = def.tools
      .map((name) => toolLookup(name))
      .filter((t): t is DynamicStructuredTool => t !== undefined);

    // 支持独立模型 + temperature
    let agentModel: ChatOpenAI;
    if (def.model_name && modelFactory) {
      agentModel = modelFactory(def.model_name);
    } else {
      agentModel = model;
    }

    // 如果指定了 temperature，创建新实例覆盖
    if (def.temperature !== undefined && def.temperature !== null) {
      agentModel = new ChatOpenAI({
        modelName: (agentModel as any).modelName || (agentModel as any).lc_kwargs?.modelName,
        openAIApiKey: (agentModel as any).lc_kwargs?.openAIApiKey,
        configuration: (agentModel as any).lc_kwargs?.configuration,
        streaming: true,
        temperature: def.temperature,
      });
    }

    return createReactAgent({
      llm: agentModel,
      tools: agentTools,
      prompt: def.system_prompt,
      name: def.id,
    });
  });

  // Agent 能力描述，供 Supervisor 路由决策
  const agentDescriptions = enabledAgents
    .map((def) => `- ${def.name}（${def.id}）: ${def.capabilities || ''} | 可用工具: ${def.tools.join(', ') || '无'}`)
    .join('\n');

  const supervisor = createSupervisor({
    agents: workerAgents as any,
    llm: model,
    prompt: `你是一个智能任务协调器（Supervisor）。你的职责是分析用户请求，将其分解为子任务，并将每个子任务分配给最合适的专业 AI 助手。

你可以多次调用不同的助手来处理复杂的多步骤任务。当一个助手返回结果后，你可以根据结果决定是否需要调用另一个助手，或者直接给出最终回答。

可用助手及其专业领域：
${agentDescriptions}

编排规则：
1. **任务分析**：仔细分析用户请求，判断是否需要单个助手还是多个助手协作
2. **单步任务**：直接调用对应助手即可
3. **多步任务**：
   a. 将复杂请求拆分为有序的子任务
   b. 按顺序调用合适的助手处理每个子任务
   c. 将前一个助手的结果作为上下文传递给下一个助手
   d. 最后综合所有结果给用户一个完整的回答
4. **路由决策**：根据每个助手的能力描述（capabilities）和可用工具匹配最合适的人选
5. **偏好尊重**：如果用户指定了偏好助手，对于该助手能力范围内的子任务优先选择该助手，但不要勉强将不适合的任务硬塞给它

特殊路由规则（最高优先级）：
- 定时任务、提醒、闹钟、日程相关的请求 → 必须路由到拥有 cron_job 工具的助手
- 记忆提取和知识查询 → 路由到拥有相应工具的助手
- 联网搜索需求 → 路由到拥有 web_search 工具的助手

编排示例：
- "搜索 Python 最新版本的信息，然后写一个安装脚本" → 先调用拥有 web_search 的助手搜索信息，再将结果传给编程助手写脚本
- "翻译这段话并设置定时提醒" → 先调用翻译相关助手翻译，再调用拥有 cron_job 的助手设置提醒
- "每天早上8点告诉我天气" → 调用拥有 cron_job 工具的助手
- 简单闲聊或单领域问题 → 直接路由到最合适的单个助手`,
    outputMode: 'full_history',
    addHandoffBackMessages: true,
    supervisorName: 'supervisor',
  });

  return supervisor.compile({ checkpointer });
}
