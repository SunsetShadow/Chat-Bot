import { z } from 'zod';
import { safeTool } from './base/tool.helper';
import { CalendarService } from '../../calendar/calendar.service';

export function createCalendarTool(calendarService: CalendarService) {
  return safeTool(
    'calendar',
    `管理日历日程事件。

**必填：每次调用必须包含 action 字段。**

## action=create（创建事件）— 必填 title, start_time
{"action":"create","title":"团队周会","start_time":"2026-04-25T14:00:00+08:00","end_time":"2026-04-25T15:00:00+08:00","description":"讨论本周进度","location":"会议室A","remind_before_ms":600000}

## action=list（查询事件）
{"action":"list","time_min":"2026-04-25T00:00:00+08:00","time_max":"2026-04-30T23:59:59+08:00"}

## action=update（更新事件）— 必填 event_id
{"action":"update","event_id":"事件ID","title":"新标题","start_time":"2026-04-25T15:00:00+08:00"}

## action=delete（删除事件）— 必填 event_id
{"action":"delete","event_id":"事件ID"}

## action=search（搜索事件）— 必填 query
{"action":"search","query":"周会"}

## 时间格式
ISO 8601 格式，如 "2026-04-25T14:00:00+08:00"。用户说"下午3点"等自然语言时间时，请转换为 ISO 8601。

## remind_before_ms 说明
提前提醒毫秒数：5分钟=300000，10分钟=600000，30分钟=1800000，1小时=3600000。

## color 说明
可选颜色标签：#3b82f6(蓝), #10b981(绿), #f59e0b(橙), #ef4444(红), #8b5cf6(紫), #ec4899(粉)。不填则使用默认色。`,
    z.object({
      action: z.enum(['create', 'list', 'update', 'delete', 'search']),
      title: z.string().optional().describe('事件标题，create/update 时使用'),
      description: z.string().optional().describe('事件描述'),
      start_time: z.string().optional().describe('开始时间 ISO 8601'),
      end_time: z.string().optional().describe('结束时间 ISO 8601'),
      all_day: z.boolean().optional().describe('是否全天事件'),
      location: z.string().optional().describe('地点'),
      remind_before_ms: z.number().int().min(0).optional().describe('提前提醒毫秒数'),
      color: z.string().optional().describe('颜色标签'),
      event_id: z.string().optional().describe('事件 ID，update/delete 时必填'),
      query: z.string().optional().describe('搜索关键词，search 时使用'),
      time_min: z.string().optional().describe('查询开始时间，list 时使用'),
      time_max: z.string().optional().describe('查询结束时间，list 时使用'),
    }),
    async ({ action, title, description, start_time, end_time, all_day, location, remind_before_ms, color, event_id, query, time_min, time_max }, config) => {
      const sessionId = config?.configurable?.thread_id;

      switch (action) {
        case 'create': {
          if (!title) return '创建事件需要提供 title。';
          if (!start_time) return '创建事件需要提供 start_time。';
          const event = await calendarService.createEvent(
            {
              title,
              description,
              start_time,
              end_time,
              all_day,
              location,
              remind_before_ms,
              color,
            },
            sessionId,
          );
          return `已创建日历事件：id=${event.id} title=${event.title} start=${event.start_time.toISOString()}`;
        }

        case 'list': {
          const now = new Date();
          const min = time_min ?? new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
          const max = time_max ?? new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
          const events = await calendarService.listEvents(min, max);
          if (!events.length) return '该时间范围内没有日历事件。';
          return '日历事件列表：\n' + events.map((e) =>
            `id=${e.id} title=${e.title} start=${e.start_time.toISOString()} end=${e.end_time?.toISOString() ?? '无'} all_day=${e.all_day} location=${e.location ?? '无'}`,
          ).join('\n');
        }

        case 'update': {
          if (!event_id) return 'update 需要提供 event_id。';
          const updated = await calendarService.updateEvent(event_id, {
            title, description, start_time, end_time, all_day, location, remind_before_ms, color,
          });
          return `已更新日历事件：id=${updated.id} title=${updated.title}`;
        }

        case 'delete': {
          if (!event_id) return 'delete 需要提供 event_id。';
          await calendarService.deleteEvent(event_id);
          return `已删除日历事件：id=${event_id}`;
        }

        case 'search': {
          if (!query) return 'search 需要提供 query。';
          const results = await calendarService.searchEvents(query);
          if (!results.length) return `没有找到与"${query}"相关的事件。`;
          return '搜索结果：\n' + results.map((e) =>
            `id=${e.id} title=${e.title} start=${e.start_time.toISOString()}`,
          ).join('\n');
        }

        default:
          return `不支持的操作: ${action}`;
      }
    },
  );
}
