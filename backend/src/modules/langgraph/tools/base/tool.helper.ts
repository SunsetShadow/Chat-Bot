import { z } from 'zod';
import { DynamicStructuredTool } from '@langchain/core/tools';

/**
 * 统一工具错误格式 — 给 Agent 返回友好的错误消息，而非 stack trace
 */
export function toolError(toolName: string, error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return `[${toolName} 执行失败] ${message}`;
}

/**
 * 带默认错误包装的 tool 创建辅助函数
 * 自动 catch 异常并返回格式化错误，避免 stack trace 泄露给 Agent
 *
 * handler 签名支持可选的 config 参数（RunnableConfig），
 * 包含 configurable.thread_id（即 session_id）等上下文信息
 */
export function safeTool<T extends z.ZodTypeAny>(
  name: string,
  description: string,
  schema: T,
  handler: (input: z.infer<T>, config?: any) => Promise<string>,
): DynamicStructuredTool {
  return new DynamicStructuredTool({
    name,
    description,
    schema,
    func: async (input, _runManager, config) => {
      try {
        return await handler(input, config);
      } catch (error) {
        return toolError(name, error);
      }
    },
  });
}

export type { DynamicStructuredTool };
