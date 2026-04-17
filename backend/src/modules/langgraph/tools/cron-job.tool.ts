import { z } from 'zod';
import { safeTool } from './base/tool.helper';
import { JobService } from '../../cron-job/job.service';

export function createCronJobTool(jobService: JobService) {
  return safeTool(
    'cron_job',
    `管理定时任务。

**必填：每次调用必须包含 action 字段。**

## action=list（查看）
{"action":"list"}

## action=add（新增）— 必填 action, type, instruction
type=at（一次性）— 优先用 delayMs，也可用 at：
  {"action":"add","type":"at","delayMs":60000,"instruction":"一分钟后提醒我喝水"}
  {"action":"add","type":"at","at":"2026-04-17T18:30:00+08:00","instruction":"明天下午6点半提醒我开会"}
type=every（循环）：
  {"action":"add","type":"every","everyMs":3600000,"instruction":"每小时提醒我休息"}
type=cron（Cron 表达式）：
  {"action":"add","type":"cron","cron":"0 9 * * 1-5","instruction":"工作日每天早上9点提醒我站会"}

## action=toggle（切换状态）— 必填 id
{"action":"toggle","id":"任务ID","enabled":false}

## action=delete（删除）— 必填 id
{"action":"delete","id":"任务ID"}

## delayMs 说明
用户说"X分钟后""X小时后"等相对时间时，用 delayMs（毫秒）：1分钟=60000，5分钟=300000，1小时=3600000，1天=86400000。
用 delayMs 时不需要 at 参数。只有用户指定了具体日期时间时才用 at。

## instruction 规则
保持用户原始表述，不要改写或总结。`,
    z.object({
      action: z.enum(['list', 'add', 'toggle', 'delete']),
      type: z.enum(['cron', 'every', 'at']).optional().describe('任务类型，add 时必填'),
      instruction: z.string().optional().describe('自然语言任务指令，add 时必填'),
      cron: z.string().optional().describe('Cron 表达式，type=cron 时必填'),
      everyMs: z.number().int().positive().optional().describe('间隔毫秒，type=every 时必填'),
      delayMs: z.number().int().positive().optional().describe('延迟毫秒，type=at 时优先使用（1分钟=60000）。提供此参数则忽略 at'),
      at: z.string().optional().describe('绝对时间 ISO 8601，type=at 时使用（优先使用 delayMs 避免时间过期）'),
      id: z.string().optional().describe('任务 ID，toggle/delete 时必填'),
      enabled: z.boolean().optional().describe('启用/停用，toggle 时使用'),
    }),
    async ({ action, type, instruction, cron, everyMs, delayMs, at, id, enabled }, config) => {
      const sessionId = config?.configurable?.thread_id;
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
            const created = await jobService.addJob({ type: 'cron', instruction, cron, created_by_session: sessionId });
            return `已新增定时任务：id=${created.id} type=cron cron=${created.cron}`;
          }
          if (type === 'every') {
            if (!everyMs) return 'type=every 时需要提供 everyMs（毫秒）。';
            const created = await jobService.addJob({ type: 'every', instruction, every_ms: everyMs, created_by_session: sessionId });
            return `已新增定时任务：id=${created.id} type=every everyMs=${created.every_ms}`;
          }
          if (type === 'at') {
            let date: Date;
            if (delayMs) {
              date = new Date(Date.now() + delayMs);
            } else if (at) {
              date = new Date(at);
              if (Number.isNaN(date.getTime())) return 'at 不是合法的 ISO 8601 时间。';
              if (date.getTime() <= Date.now()) return 'at 时间已过期。建议使用 delayMs 参数（如1分钟=60000毫秒）避免此问题。';
            } else {
              return 'type=at 时需要提供 delayMs（推荐）或 at 参数。';
            }
            const created = await jobService.addJob({ type: 'at', instruction, at: date, created_by_session: sessionId });
            return `已新增定时任务：id=${created.id} type=at at=${created.at?.toISOString()}`;
          }
          return `不支持的任务类型: ${type}`;
        }

        case 'toggle': {
          if (!id) return 'toggle 需要提供任务 id。';
          const updated = await jobService.toggleJob(id, enabled);
          return `已更新任务状态：id=${updated.id} enabled=${updated.is_enabled}`;
        }

        case 'delete': {
          if (!id) return 'delete 需要提供任务 id。';
          await jobService.deleteJob(id);
          return `已删除定时任务：id=${id}`;
        }

        default:
          return `不支持的操作: ${action}`;
      }
    },
  );
}
