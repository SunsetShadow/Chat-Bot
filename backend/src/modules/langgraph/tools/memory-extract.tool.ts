import { z } from 'zod';
import { MemoryService } from '../../memory/memory.service';
import { safeTool } from './base/tool.helper';

export function createMemoryExtractTool(memoryService: MemoryService) {
  return safeTool(
    'extract_memory',
    '从对话中提取重要信息并保存为长期记忆。当用户分享了个人偏好、重要事实、或关键事件时使用此工具。',
    z.object({
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
    async ({ content, memory_type, importance }) => {
      await memoryService.create({
        content,
        type: memory_type as any,
        importance,
      });
      return `记忆已保存：${content}`;
    },
  );
}
