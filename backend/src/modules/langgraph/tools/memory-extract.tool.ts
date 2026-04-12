import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import { MemoryService } from '../../memory/memory.service';
import { MemoryType } from '../../../common/entities/memory.entity';

/**
 * Factory function — creates the memory extract tool with MemoryService injected.
 * LangChain tools cannot use NestJS DI directly, so we pass the service in.
 */
export function createMemoryExtractTool(memoryService: MemoryService) {
  return tool(
    async ({ content, memory_type, importance }) => {
      try {
        await memoryService.create({
          content,
          type: memory_type as MemoryType,
          importance,
        });
        return `记忆已保存：${content}`;
      } catch (error) {
        return `保存记忆失败：${error instanceof Error ? error.message : '未知错误'}`;
      }
    },
    {
      name: 'extract_memory',
      description:
        '从对话中提取重要信息并保存为长期记忆。当用户分享了个人偏好、重要事实、或关键事件时使用此工具。',
      schema: z.object({
        content: z.string().describe('提取的记忆内容，简洁明了'),
        memory_type: z
          .enum(['fact', 'preference', 'event'])
          .describe('记忆类型：fact=事实, preference=偏好, event=事件'),
        importance: z
          .number()
          .min(1)
          .max(10)
          .default(5)
          .describe('重要程度 1-10'),
      }),
    },
  );
}

/**
 * @deprecated Use createMemoryExtractTool(memoryService) instead.
 * Kept for backward compatibility during migration.
 */
export { createMemoryExtractTool as memoryExtractTool };
