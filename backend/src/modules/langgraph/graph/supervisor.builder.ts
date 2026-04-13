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
    .map((def) => `- ${def.name}: ${def.capabilities || ''}`)
    .join('\n');

  const supervisor = createSupervisor({
    agents: workerAgents as any,
    llm: model,
    prompt: `你是一个智能任务调度器。分析用户请求，将其分配给最合适的专业 AI 助手。

可用助手及其专业领域：
${agentDescriptions}

调度规则：
1. 仔细分析用户意图和请求类型
2. 根据每个助手的专业能力（capabilities）匹配最合适的人选
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

  return supervisor.compile({ checkpointer });
}
