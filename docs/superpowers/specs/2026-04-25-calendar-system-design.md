# Calendar System Design

## Overview

为 Chat-Bot 新增日历日程系统，用户可通过自然语言对话创建/管理日程，日历 UI 展示日程事件和定时任务。

## Goals

1. 自然语言对话 → 创建/查询/修改/删除日程事件
2. 日历 UI 展示日程（月/周/日视图）
3. 在同一日历上同时展示日程事件和定时任务
4. 日程提醒通知（复用现有通知系统）

## Non-Goals

- 外部日历同步（Google Calendar 等）— 留作未来扩展
- 会议/多人调度
- Agent-to-Agent 谈判

## Architecture

```
用户对话 → Supervisor Agent → calendar 工具 → CalendarService → DB
                                                          ↓
日历 UI ← CalendarView ← CalendarStore ← Calendar API ← CalendarController

定时任务 → JobEntity → JobService → CalendarService.listJobsAsEvents() → 日历 UI
```

## Data Model

### CalendarEvent Entity

```typescript
@Entity('calendar_events')
export class CalendarEventEntity {
  id: string;                    // UUID
  title: string;                 // 事件标题
  description: string | null;    // 事件描述
  start_time: Date;              // 开始时间
  end_time: Date | null;         // 结束时间（null 表示全天事件）
  all_day: boolean;              // 是否全天
  color: string | null;          // 事件颜色标签
  location: string | null;       // 地点
  remind_before_ms: number | null; // 提前多少毫秒提醒
  recurrence_rule: string | null;  // RRULE 重复规则（未来扩展）
  source: 'calendar' | 'cron_job'; // 事件来源
  source_id: string | null;      // 关联来源 ID（cron job id）
  agent_id: string | null;       // 创建事件的 Agent ID
  created_by_session: string | null;
  created_at: Date;
  updated_at: Date;
}
```

### 与 JobEntity 的关系

CalendarEvent 和 Job 是独立实体。日历视图通过 `source: 'cron_job'` 标记来自定时任务的事件，也可以直接查询 Job 列表按调度规则在日历上渲染。

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/calendar/events` | 查询事件（timeMin/timeMax 过滤） |
| GET | `/api/v1/calendar/events/:id` | 单个事件详情 |
| POST | `/api/v1/calendar/events` | 创建事件 |
| PATCH | `/api/v1/calendar/events/:id` | 更新事件 |
| DELETE | `/api/v1/calendar/events/:id` | 删除事件 |
| GET | `/api/v1/calendar/cron-events` | 获取定时任务映射的日历事件 |

## AI Agent Tool

新增 `calendar` 工具（safeTool 模式，category: 'productivity'）：

```
calendar(action: 'create' | 'list' | 'update' | 'delete' | 'search',
  title?, description?, start_time?, end_time?, all_day?,
  location?, remind_before?, event_id?, query?,
  time_min?, time_max?)
```

- `create`: 创建日程事件，支持自然语言时间解析（LLM 负责）
- `list`: 查询指定时间范围的事件
- `update`: 修改已有事件
- `delete`: 删除事件
- `search`: 按关键词搜索事件

工具注册到 ToolRegistryService，绑定到 Ani（默认 Agent）。

## Frontend

### CalendarView

使用 `@fullcalendar/vue3` 实现：
- 三种视图切换：月/周/日
- 事件点击 → 弹出详情/编辑模态框
- 拖拽调整时间
- 左侧 mini 月历导航
- 右侧事件列表面板

### 日历上的定时任务

定时任务根据调度规则（cron/every/at）在日历上生成虚拟事件：
- cron 类型：按 cron 表达式展开未来 N 次执行时间
- every 类型：按间隔计算未来 N 次
- at 类型：单次事件

这些虚拟事件用不同颜色标记，点击跳转到 CronJobsView。

### 导航集成

AppHeader 新增日历图标（CalendarOutline），路由 `/calendar`。

### 样式

遵循项目暗色/亮色双主题，与现有 UI 风格一致。

## Notification Integration

日程提醒复用现有通知系统：
- CalendarService 启动时注册提醒调度器
- 检查未来事件，到 remind_before_ms 时触发通知
- 通知类型扩展：`type: 'calendar_reminder'`

## File Structure

```
backend/src/
  common/entities/calendar-event.entity.ts
  modules/calendar/
    calendar.module.ts
    calendar.controller.ts
    calendar.service.ts
    calendar.reminder.service.ts
  modules/langgraph/tools/calendar.tool.ts

frontend/src/
  views/CalendarView.vue
  components/calendar/
    EventDetailModal.vue
    EventFormModal.vue
    CalendarSidebar.vue
  api/calendar.ts
  stores/calendar.ts
  types/calendar.ts
```

## Implementation Priority

1. CalendarEvent entity + migration
2. CalendarModule (controller + service)
3. Calendar tool for AI agent
4. CalendarView (FullCalendar integration)
5. Cron job → calendar event mapping
6. Reminder notification
7. Navigation integration
