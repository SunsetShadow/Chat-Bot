import { StateGraph, MessagesAnnotation, MemorySaver, START, END } from '@langchain/langgraph';
import { ToolNode } from '@langchain/langgraph/prebuilt';
import { ChatOpenAI } from '@langchain/openai';
import { StructuredToolInterface } from '@langchain/core/tools';
import { AIMessage } from '@langchain/core/messages';
import { createAgentNode } from './nodes/agent.node';

export function buildGraph(
  model: ChatOpenAI,
  tools: StructuredToolInterface[],
) {
  const agentNode = createAgentNode(model, tools);
  const toolNode = new ToolNode<typeof MessagesAnnotation.State>(tools);

  function routeMessage(state: typeof MessagesAnnotation.State) {
    const lastMessage = state.messages[state.messages.length - 1];
    if (lastMessage instanceof AIMessage && lastMessage.tool_calls?.length) {
      return 'tools';
    }
    return END;
  }

  const checkpointer = new MemorySaver();

  const workflow = new StateGraph(MessagesAnnotation)
    .addNode('agent', agentNode)
    .addNode('tools', toolNode)
    .addEdge(START, 'agent')
    .addConditionalEdges('agent', routeMessage)
    .addEdge('tools', 'agent');

  return workflow.compile({ checkpointer });
}
