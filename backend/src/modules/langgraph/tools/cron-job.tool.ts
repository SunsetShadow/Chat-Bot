import { z } from 'zod';
import { safeTool } from './base/tool.helper';
import { JobService } from '../../cron-job/job.service';

export function createCronJobTool(jobService: JobService) {
  return safeTool(
    'cron_job',
    `管理定时任务。

操作说明：
- action=list: 查看当前所有定时任务列表
- action=add: 新增一个定时任务
- action=toggle: 启用或停用指定任务

类型选择规则：
- 一次性任务（"X分钟后""明天""下周一"）→ type=at, 提供 at 参数（ISO 8601）
- 固定间隔循环（"每X分钟""每小时""每天"）→ type=every, 提供 everyMs 参数（毫秒）
- Cron 表达式（"0 9 * * *"）→ type=cron, 提供 cron 参数

instruction 规则：
- 保持用户原始表述，不要改写、翻译或总结
- 必须是自然语言描述，不能写成工具调用脚本`,
    z.object({
      action: z.enum(['list', 'add', 'toggle']),
      type: z.enum(['cron', 'every', 'at']).optional().describe('任务类型，add 时必填'),
      instruction: z.string().optional().describe('自然语言任务指令，add 时必填'),
      cron: z.string().optional().describe('Cron 表达式，type=cron 时必填'),
      everyMs: z.number().int().positive().optional().describe('间隔毫秒，type=every 时必填'),
      at: z.string().optional().describe('ISO 8601 时间，type=at 时必填'),
      id: z.string().optional().describe('任务 ID，toggle 时必填'),
      enabled: z.boolean().optional().describe('启用/停用，toggle 时使用'),
    }),
    async ({ action, type, instruction, cron, everyMs, at, id, enabled }) => {
      switch (action) {
        case 'list': {
          const jobs = await jobService.listJobs();
          if (!jobs.length) return '当前没有任何定时任务。';
          return '当前定时任务列表：\n' + jobs.map((j: any) =>
            `id=${j.id} type=${j.type} enabled=${j.is_enabled} running=${j.running} ` +
            `failures=${j.consecutive_failures ?? 0} ` +
            `cron=${j.cron ?? ''} everyMs=${j.every_ms ?? ''} ` +
            `at=${j.at instanceof Date ? j.at.toISOString() : j.at ?? ''} ` +
            `instruction=${j.instruction ?? ''}`,
          ).join('\n');
        }

        case 'add': {
          if (!type) return '新增任务需要提供 type（cron/every/at）。';
          if (!instruction) return '新增任务需要提供 instruction。';

          if (type === 'cron') {
            if (!cron) return 'type=cron 时需要提供 cron 表达式。';
            const created = await jobService.addJob({ type: 'cron', instruction, cron });
            return `已新增定时任务：id=${created.id} type=cron cron=${created.cron}`;
          }
          if (type === 'every') {
            if (!everyMs) return 'type=every 时需要提供 everyMs（毫秒）。';
            const created = await jobService.addJob({ type: 'every', instruction, every_ms: everyMs });
            return `已新增定时任务：id=${created.id} type=every everyMs=${created.every_ms}`;
          }
          if (type === 'at') {
            if (!at) return 'type=at 时需要提供 at 时间（ISO 8601）。';
            const date = new Date(at);
            if (Number.isNaN(date.getTime())) return 'at 不是合法的 ISO 8601 时间。';
            const created = await jobService.addJob({ type: 'at', instruction, at: date });
            return `已新增定时任务：id=${created.id} type=at at=${created.at?.toISOString()}`;
          }
          return `不支持的任务类型: ${type}`;
        }

        case 'toggle': {
          if (!id) return 'toggle 需要提供任务 id。';
          const updated = await jobService.toggleJob(id, enabled);
          return `已更新任务状态：id=${updated.id} enabled=${updated.is_enabled}`;
        }

        default:
          return `不支持的操作: ${action}`;
      }
    },
  );
}
