# Calendar System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Chat-Bot 新增日历日程系统，支持自然语言创建/管理日程，日历 UI 展示事件和定时任务。

**Architecture:** 新增 CalendarEvent 实体 + CalendarModule（后端）+ calendar 工具（AI Agent）+ CalendarView（前端 FullCalendar）。复用现有 safeTool 模式、通知系统、Pinia store 模式。

**Tech Stack:** NestJS TypeORM, @fullcalendar/vue3, Naive UI, Vue 3 Composition API, Pinia, Tailwind CSS

---

## File Structure

### Backend (Create)
- `backend/src/common/entities/calendar-event.entity.ts` — CalendarEvent 实体
- `backend/src/modules/calendar/calendar.module.ts` — Calendar 模块注册
- `backend/src/modules/calendar/calendar.controller.ts` — REST API 控制器
- `backend/src/modules/calendar/calendar.service.ts` — 业务逻辑服务
- `backend/src/modules/calendar/dto/create-event.dto.ts` — 创建事件 DTO
- `backend/src/modules/calendar/dto/update-event.dto.ts` — 更新事件 DTO
- `backend/src/modules/langgraph/tools/calendar.tool.ts` — AI Agent 日历工具

### Backend (Modify)
- `backend/src/common/entities/notification.entity.ts` — 扩展通知类型
- `backend/src/modules/langgraph/langgraph.module.ts` — 注册 calendar 工具
- `backend/src/app.module.ts` — 注册 CalendarModule

### Frontend (Create)
- `frontend/src/types/calendar.ts` — 类型定义
- `frontend/src/api/calendar.ts` — API 封装
- `frontend/src/stores/calendar.ts` — Pinia Store
- `frontend/src/views/CalendarView.vue` — 日历主页面
- `frontend/src/components/calendar/EventDetailModal.vue` — 事件详情/编辑弹窗
- `frontend/src/components/calendar/EventFormModal.vue` — 创建/编辑事件表单

### Frontend (Modify)
- `frontend/src/router/index.ts` — 添加 /calendar 路由
- `frontend/src/components/common/AppHeader.vue` — 添加日历导航图标

---

### Task 1: Install Frontend Dependencies

- [ ] **Step 1: Install @fullcalendar/vue3 and plugins**

```bash
cd frontend && pnpm add @fullcalendar/vue3 @fullcalendar/core @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction @fullcalendar/list
```

Expected: `pnpm` installs all packages successfully.

---

### Task 2: Create CalendarEvent Entity

**Files:**
- Create: `backend/src/common/entities/calendar-event.entity.ts`

- [ ] **Step 1: Create the entity file**

```typescript
// backend/src/common/entities/calendar-event.entity.ts
import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('calendar_events')
export class CalendarEventEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column('varchar', { length: 200 })
  title: string;

  @Column('text', { nullable: true })
  description: string | null;

  @Column('timestamp')
  start_time: Date;

  @Column('timestamp', { nullable: true })
  end_time: Date | null;

  @Column({ default: false })
  all_day: boolean;

  @Column('varchar', { length: 20, nullable: true })
  color: string | null;

  @Column('varchar', { length: 500, nullable: true })
  location: string | null;

  @Column('int', { nullable: true })
  remind_before_ms: number | null;

  @Column('varchar', { nullable: true })
  recurrence_rule: string | null;

  @Column('varchar', { length: 20, default: 'calendar' })
  source: 'calendar' | 'cron_job';

  @Column('uuid', { nullable: true })
  source_id: string | null;

  @Column('varchar', { nullable: true })
  agent_id: string | null;

  @Column('uuid', { nullable: true })
  created_by_session: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
```

---

### Task 3: Create DTOs

**Files:**
- Create: `backend/src/modules/calendar/dto/create-event.dto.ts`
- Create: `backend/src/modules/calendar/dto/update-event.dto.ts`

- [ ] **Step 1: Create directory and DTO files**

```bash
mkdir -p backend/src/modules/calendar/dto
```

```typescript
// backend/src/modules/calendar/dto/create-event.dto.ts
import {
  IsString,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  start_time: string;

  @IsDateString()
  @IsOptional()
  end_time?: string;

  @IsBoolean()
  @IsOptional()
  all_day?: boolean;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  location?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  remind_before_ms?: number;

  @IsString()
  @IsOptional()
  recurrence_rule?: string;
}
```

```typescript
// backend/src/modules/calendar/dto/update-event.dto.ts
import {
  IsString,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';

export class UpdateEventDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @IsString()
  @IsOptional()
  description?: string | null;

  @IsDateString()
  @IsOptional()
  start_time?: string;

  @IsDateString()
  @IsOptional()
  end_time?: string | null;

  @IsBoolean()
  @IsOptional()
  all_day?: boolean;

  @IsString()
  @IsOptional()
  color?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  location?: string | null;

  @IsInt()
  @IsOptional()
  @Min(0)
  remind_before_ms?: number | null;

  @IsString()
  @IsOptional()
  recurrence_rule?: string | null;
}
```

---

### Task 4: Create CalendarService

**Files:**
- Create: `backend/src/modules/calendar/calendar.service.ts`

- [ ] **Step 1: Create the service**

```typescript
// backend/src/modules/calendar/calendar.service.ts
import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { CalendarEventEntity } from '../../common/entities/calendar-event.entity';
import { JobService } from '../cron-job/job.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Injectable()
export class CalendarService {
  private readonly logger = new Logger(CalendarService.name);

  constructor(
    @InjectRepository(CalendarEventEntity)
    private eventRepo: Repository<CalendarEventEntity>,
    private jobService: JobService,
  ) {}

  async createEvent(dto: CreateEventDto, sessionId?: string): Promise<CalendarEventEntity> {
    const event = this.eventRepo.create({
      id: uuidv4(),
      title: dto.title,
      description: dto.description ?? null,
      start_time: new Date(dto.start_time),
      end_time: dto.end_time ? new Date(dto.end_time) : null,
      all_day: dto.all_day ?? false,
      color: dto.color ?? null,
      location: dto.location ?? null,
      remind_before_ms: dto.remind_before_ms ?? null,
      recurrence_rule: dto.recurrence_rule ?? null,
      source: 'calendar',
      created_by_session: sessionId ?? null,
    });
    return this.eventRepo.save(event);
  }

  async listEvents(timeMin?: string, timeMax?: string): Promise<CalendarEventEntity[]> {
    const where: any = {};
    if (timeMin && timeMax) {
      where.start_time = Between(new Date(timeMin), new Date(timeMax));
    }
    return this.eventRepo.find({ where, order: { start_time: 'ASC' } });
  }

  async getEvent(id: string): Promise<CalendarEventEntity> {
    const event = await this.eventRepo.findOne({ where: { id } });
    if (!event) throw new NotFoundException(`事件 ${id} 不存在`);
    return event;
  }

  async updateEvent(id: string, dto: UpdateEventDto): Promise<CalendarEventEntity> {
    const event = await this.getEvent(id);
    Object.assign(event, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.start_time !== undefined && { start_time: new Date(dto.start_time) }),
      ...(dto.end_time !== undefined && { end_time: dto.end_time ? new Date(dto.end_time) : null }),
      ...(dto.all_day !== undefined && { all_day: dto.all_day }),
      ...(dto.color !== undefined && { color: dto.color }),
      ...(dto.location !== undefined && { location: dto.location }),
      ...(dto.remind_before_ms !== undefined && { remind_before_ms: dto.remind_before_ms }),
      ...(dto.recurrence_rule !== undefined && { recurrence_rule: dto.recurrence_rule }),
    });
    return this.eventRepo.save(event);
  }

  async deleteEvent(id: string): Promise<void> {
    const event = await this.getEvent(id);
    await this.eventRepo.remove(event);
  }

  async searchEvents(query: string): Promise<CalendarEventEntity[]> {
    return this.eventRepo
      .createQueryBuilder('e')
      .where('e.title ILIKE :q OR e.description ILIKE :q', { q: `%${query}%` })
      .orderBy('e.start_time', 'ASC')
      .limit(50)
      .getMany();
  }

  /**
   * 将定时任务映射为日历事件（虚拟事件，不入库）
   */
  async getCronJobEvents(timeMin: string, timeMax: string): Promise<CalendarEventEntity[]> {
    const jobs = await this.jobService.listJobs();
    const enabledJobs = jobs.filter((j) => j.is_enabled);
    const start = new Date(timeMin);
    const end = new Date(timeMax);
    const events: CalendarEventEntity[] = [];

    for (const job of enabledJobs) {
      const times = this.expandScheduleTimes(job, start, end);
      for (const time of times) {
        events.push(
          this.eventRepo.create({
            id: `cron-${job.id}-${time.getTime()}`,
            title: `⏰ ${job.instruction}`,
            description: `定时任务: ${job.instruction}\n类型: ${job.type}`,
            start_time: time,
            end_time: new Date(time.getTime() + 30 * 60 * 1000),
            all_day: false,
            color: '#f59e0b',
            source: 'cron_job',
            source_id: job.id,
          }),
        );
      }
    }

    return events;
  }

  private expandScheduleTimes(
    job: any,
    start: Date,
    end: Date,
  ): Date[] {
    const times: Date[] = [];
    const maxOccurrences = 50;

    if (job.type === 'at' && job.at) {
      const at = job.at instanceof Date ? job.at : new Date(job.at);
      if (at >= start && at <= end) times.push(at);
    } else if (job.type === 'every' && job.every_ms) {
      const everyMs = job.every_ms;
      let t = new Date(start);
      while (t <= end && times.length < maxOccurrences) {
        t = new Date(t.getTime() + everyMs);
        if (t >= start && t <= end) times.push(new Date(t));
      }
    } else if (job.type === 'cron' && job.cron) {
      try {
        const { CronJob } = require('cron');
        const cron = new CronJob(job.cron, () => {}, null, false, job.timezone || 'Asia/Shanghai');
        let t = cron.getNextDateFrom(start);
        while (t <= end && times.length < maxOccurrences) {
          times.push(new Date(t));
          t = cron.getNextDateFrom(new Date(t.getTime() + 60000));
        }
      } catch {
        // 无效 cron 表达式，跳过
      }
    }

    return times;
  }
}
```

---

### Task 5: Create CalendarController

**Files:**
- Create: `backend/src/modules/calendar/calendar.controller.ts`

- [ ] **Step 1: Create the controller**

```typescript
// backend/src/modules/calendar/calendar.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CalendarService } from './calendar.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';

@Controller('api/v1/calendar')
export class CalendarController {
  constructor(private calendarService: CalendarService) {}

  @Get('events')
  async listEvents(
    @Query('timeMin') timeMin?: string,
    @Query('timeMax') timeMax?: string,
  ) {
    const events = await this.calendarService.listEvents(timeMin, timeMax);
    return { success: true, data: events };
  }

  @Get('events/:id')
  async getEvent(@Param('id') id: string) {
    const event = await this.calendarService.getEvent(id);
    return { success: true, data: event };
  }

  @Post('events')
  async createEvent(@Body() dto: CreateEventDto) {
    const event = await this.calendarService.createEvent(dto);
    return { success: true, data: event };
  }

  @Patch('events/:id')
  async updateEvent(
    @Param('id') id: string,
    @Body() dto: UpdateEventDto,
  ) {
    const event = await this.calendarService.updateEvent(id, dto);
    return { success: true, data: event };
  }

  @Delete('events/:id')
  async deleteEvent(@Param('id') id: string) {
    await this.calendarService.deleteEvent(id);
    return { success: true };
  }

  @Get('cron-events')
  async getCronJobEvents(
    @Query('timeMin') timeMin: string,
    @Query('timeMax') timeMax: string,
  ) {
    const events = await this.calendarService.getCronJobEvents(timeMin, timeMax);
    return { success: true, data: events };
  }

  @Get('search')
  async searchEvents(@Query('q') q: string) {
    const events = await this.calendarService.searchEvents(q);
    return { success: true, data: events };
  }
}
```

---

### Task 6: Create CalendarModule + Register

**Files:**
- Create: `backend/src/modules/calendar/calendar.module.ts`
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Create CalendarModule**

```typescript
// backend/src/modules/calendar/calendar.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CalendarEventEntity } from '../../common/entities/calendar-event.entity';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';
import { CronJobModule } from '../cron-job/cron-job.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CalendarEventEntity]),
    forwardRef(() => CronJobModule),
  ],
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
```

- [ ] **Step 2: Register CalendarModule in AppModule**

在 `backend/src/app.module.ts` 中添加：

```typescript
// 新增 import
import { CalendarModule } from './modules/calendar/calendar.module';

// 在 imports 数组中添加 CalendarModule（在 CronJobModule 之后）
```

---

### Task 7: Extend NotificationType

**Files:**
- Modify: `backend/src/common/entities/notification.entity.ts`

- [ ] **Step 1: Add calendar_reminder type**

修改 `NotificationType` 从 `'cron_job'` 扩展为 `'cron_job' | 'calendar_reminder'`：

```typescript
export type NotificationType = 'cron_job' | 'calendar_reminder';
```

同时修改 Column default 的 varchar length 从 20 改为 30（容纳 `calendar_reminder`）。

---

### Task 8: Create Calendar Tool for AI Agent

**Files:**
- Create: `backend/src/modules/langgraph/tools/calendar.tool.ts`

- [ ] **Step 1: Create the calendar tool**

```typescript
// backend/src/modules/langgraph/tools/calendar.tool.ts
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
```

---

### Task 9: Register Calendar Tool in LangGraphModule

**Files:**
- Modify: `backend/src/modules/langgraph/langgraph.module.ts`

- [ ] **Step 1: Add imports and registration**

在 `langgraph.module.ts` 中：

1. 新增 import:
```typescript
import { createCalendarTool } from './tools/calendar.tool';
import { CalendarService } from '../calendar/calendar.service';
```

2. 在 Module imports 中添加 `forwardRef(() => CalendarModule)`

3. 在 `onModuleInit()` 中添加工具注册（在 cron_job 工具注册之后）:
```typescript
// 注册日历日程工具
this.toolRegistry.register(
  createCalendarTool(this.moduleRef.get(CalendarService, { strict: false })),
  {
    permission_level: 'write',
    category: 'productivity',
    description: '创建和管理日历日程事件',
  },
);
```

---

### Task 10: Frontend Types

**Files:**
- Create: `frontend/src/types/calendar.ts`

- [ ] **Step 1: Create types**

```typescript
// frontend/src/types/calendar.ts
export interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  all_day: boolean;
  color: string | null;
  location: string | null;
  remind_before_ms: number | null;
  recurrence_rule: string | null;
  source: 'calendar' | 'cron_job';
  source_id: string | null;
  agent_id: string | null;
  created_by_session: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateEventRequest {
  title: string;
  description?: string;
  start_time: string;
  end_time?: string;
  all_day?: boolean;
  color?: string;
  location?: string;
  remind_before_ms?: number;
}

export interface UpdateEventRequest {
  title?: string;
  description?: string | null;
  start_time?: string;
  end_time?: string | null;
  all_day?: boolean;
  color?: string | null;
  location?: string | null;
  remind_before_ms?: number | null;
}
```

---

### Task 11: Frontend API

**Files:**
- Create: `frontend/src/api/calendar.ts`

- [ ] **Step 1: Create API wrapper**

```typescript
// frontend/src/api/calendar.ts
import { get, post, del, patch } from "./request";
import type {
  CalendarEvent,
  CreateEventRequest,
  UpdateEventRequest,
} from "@/types/calendar";

const BASE = "/api/v1/calendar";

export async function getEvents(timeMin?: string, timeMax?: string) {
  const params: Record<string, string> = {};
  if (timeMin) params.timeMin = timeMin;
  if (timeMax) params.timeMax = timeMax;
  return get<{ success: boolean; data: CalendarEvent[] }>(`${BASE}/events`, params);
}

export async function getEvent(id: string) {
  return get<{ success: boolean; data: CalendarEvent }>(`${BASE}/events/${id}`);
}

export async function createEvent(data: CreateEventRequest) {
  return post<{ success: boolean; data: CalendarEvent }>(`${BASE}/events`, data);
}

export async function updateEvent(id: string, data: UpdateEventRequest) {
  return patch<{ success: boolean; data: CalendarEvent }>(`${BASE}/events/${id}`, data);
}

export async function deleteEvent(id: string) {
  return del<{ success: boolean }>(`${BASE}/events/${id}`);
}

export async function getCronJobEvents(timeMin: string, timeMax: string) {
  return get<{ success: boolean; data: CalendarEvent[] }>(`${BASE}/cron-events`, {
    timeMin,
    timeMax,
  });
}

export async function searchEvents(query: string) {
  return get<{ success: boolean; data: CalendarEvent[] }>(`${BASE}/search`, { q: query });
}
```

---

### Task 12: Frontend Pinia Store

**Files:**
- Create: `frontend/src/stores/calendar.ts`

- [ ] **Step 1: Create store**

```typescript
// frontend/src/stores/calendar.ts
import { defineStore } from "pinia";
import { ref } from "vue";
import type { CalendarEvent, CreateEventRequest, UpdateEventRequest } from "@/types/calendar";
import * as api from "@/api/calendar";

export const useCalendarStore = defineStore("calendar", () => {
  const events = ref<CalendarEvent[]>([]);
  const cronEvents = ref<CalendarEvent[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  async function fetchEvents(timeMin?: string, timeMax?: string) {
    isLoading.value = true;
    error.value = null;
    try {
      const res = await api.getEvents(timeMin, timeMax);
      events.value = res.data;
    } catch (e) {
      error.value = e instanceof Error ? e.message : "获取事件失败";
    } finally {
      isLoading.value = false;
    }
  }

  async function fetchCronEvents(timeMin: string, timeMax: string) {
    try {
      const res = await api.getCronJobEvents(timeMin, timeMax);
      cronEvents.value = res.data;
    } catch {
      cronEvents.value = [];
    }
  }

  async function createEvent(data: CreateEventRequest) {
    const res = await api.createEvent(data);
    return res.data;
  }

  async function updateEvent(id: string, data: UpdateEventRequest) {
    const res = await api.updateEvent(id, data);
    return res.data;
  }

  async function deleteEvent(id: string) {
    await api.deleteEvent(id);
  }

  return {
    events, cronEvents, isLoading, error,
    fetchEvents, fetchCronEvents, createEvent, updateEvent, deleteEvent,
  };
});
```

---

### Task 13: CalendarView Page

**Files:**
- Create: `frontend/src/views/CalendarView.vue`

- [ ] **Step 1: Create the calendar page with FullCalendar**

这个文件较大，包含月/周/日视图切换、事件点击弹窗、创建事件弹窗。使用 FullCalendar 的 dayGrid、timeGrid、list 插件。

```vue
<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { useRouter } from "vue-router";
import FullCalendar from "@fullcalendar/vue3";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import listPlugin from "@fullcalendar/list";
import { NIcon, NButton, NSpin, NModal, NEmpty } from "naive-ui";
import { ChevronBackOutline, AddOutline } from "@vicons/ionicons5";
import { useCalendarStore } from "@/stores/calendar";
import type { CalendarEvent } from "@/types/calendar";
import EventDetailModal from "@/components/calendar/EventDetailModal.vue";
import EventFormModal from "@/components/calendar/EventFormModal.vue";
import type { EventClickArg, DateSelectArg } from "@fullcalendar/core";

const router = useRouter();
const store = useCalendarStore();

const showDetail = ref(false);
const showForm = ref(false);
const selectedEvent = ref<CalendarEvent | null>(null);
const formDefaults = ref<{ start_time?: string; end_time?: string }>({});

const calendarOptions = computed(() => ({
  plugins: [dayGridPlugin, timeGridPlugin, interactionPlugin, listPlugin],
  initialView: "dayGridMonth",
  headerToolbar: {
    left: "prev,next today",
    center: "title",
    right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek",
  },
  locale: "zh-cn",
  height: "calc(100vh - 140px)",
  editable: true,
  selectable: true,
  selectMirror: true,
  dayMaxEvents: true,
  weekends: true,
  events: allEvents.value,
  eventClick: handleEventClick,
  select: handleDateSelect,
  eventDrop: handleEventDrop,
  datesSet: handleDatesSet,
  firstDay: 1,
}));

const allEvents = computed(() => {
  const calendarEvts = store.events.map((e) => ({
    id: e.id,
    title: e.title,
    start: e.start_time,
    end: e.end_time ?? undefined,
    allDay: e.all_day,
    backgroundColor: e.color ?? "#3b82f6",
    borderColor: e.color ?? "#3b82f6",
    extendedProps: { source: e.source, sourceId: e.source_id, description: e.description, location: e.location },
  }));
  const cronEvts = store.cronEvents.map((e) => ({
    id: e.id,
    title: e.title,
    start: e.start_time,
    end: e.end_time ?? undefined,
    allDay: e.all_day,
    backgroundColor: "#f59e0b",
    borderColor: "#f59e0b",
    extendedProps: { source: e.source, sourceId: e.source_id, description: e.description },
  }));
  return [...calendarEvts, ...cronEvts];
});

let currentDateRange = { start: "", end: "" };

function handleDatesSet(arg: { startStr: string; endStr: string }) {
  currentDateRange = { start: arg.startStr, end: arg.endStr };
  store.fetchEvents(arg.startStr, arg.endStr);
  store.fetchCronEvents(arg.startStr, arg.endStr);
}

function handleEventClick(info: EventClickArg) {
  const ext = info.event.extendedProps;
  const evt: CalendarEvent = {
    id: info.event.id,
    title: info.event.title,
    description: ext.description ?? null,
    start_time: info.event.start?.toISOString() ?? "",
    end_time: info.event.end?.toISOString() ?? null,
    all_day: info.event.allDay,
    color: info.event.backgroundColor,
    location: ext.location ?? null,
    remind_before_ms: null,
    recurrence_rule: null,
    source: ext.source ?? "calendar",
    source_id: ext.sourceId ?? null,
    agent_id: null,
    created_by_session: null,
    created_at: "",
    updated_at: "",
  };
  selectedEvent.value = evt;
  showDetail.value = true;
}

function handleDateSelect(info: DateSelectArg) {
  formDefaults.value = {
    start_time: info.start.toISOString(),
    end_time: info.end.toISOString(),
  };
  selectedEvent.value = null;
  showForm.value = true;
}

async function handleEventDrop(info: any) {
  const eventId = info.event.id;
  if (eventId.startsWith("cron-")) {
    info.revert();
    return;
  }
  try {
    await store.updateEvent(eventId, {
      start_time: info.event.start.toISOString(),
      end_time: info.event.end?.toISOString() ?? null,
    });
  } catch {
    info.revert();
  }
}

function openCreateModal() {
  selectedEvent.value = null;
  formDefaults.value = {};
  showForm.value = true;
}

function goBack() {
  router.push("/");
}

onMounted(() => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
  store.fetchEvents(start, end);
  store.fetchCronEvents(start, end);
});
</script>

<template>
  <div class="calendar-page">
    <header class="calendar-header">
      <div class="flex items-center gap-3">
        <NButton text @click="goBack">
          <template #icon>
            <NIcon :component="ChevronBackOutline" size="22" />
          </template>
        </NButton>
        <h1 class="text-lg font-semibold text-[var(--text-primary)]">日历</h1>
      </div>
      <NButton type="primary" size="small" @click="openCreateModal">
        <template #icon>
          <NIcon :component="AddOutline" size="18" />
        </template>
        新建事件
      </NButton>
    </header>

    <NSpin :show="store.isLoading">
      <FullCalendar :options="calendarOptions" />
    </NSpin>

    <EventDetailModal
      v-model:show="showDetail"
      :event="selectedEvent"
      @edit="showDetail = false; showForm = true"
      @delete="handleDelete"
    />

    <EventFormModal
      v-model:show="showForm"
      :event="selectedEvent"
      :defaults="formDefaults"
      @saved="handleSaved"
    />
  </div>
</template>

<style scoped>
.calendar-page {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
}

.calendar-page :deep(.fc) {
  --fc-border-color: var(--border-subtle);
  --fc-today-bg-color: var(--bg-tertiary);
  --fc-page-bg-color: var(--bg-primary);
  --fc-neutral-bg-color: var(--bg-secondary);
  --fc-list-event-hover-bg-color: var(--bg-tertiary);
}

.calendar-page :deep(.fc .fc-button-primary) {
  background-color: var(--bg-tertiary);
  border-color: var(--border-subtle);
  color: var(--text-primary);
}

.calendar-page :deep(.fc .fc-button-primary:hover) {
  background-color: var(--color-primary);
  color: #fff;
}

.calendar-page :deep(.fc .fc-button-primary:not(:disabled).fc-button-active) {
  background-color: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.calendar-page :deep(.fc .fc-toolbar-title) {
  color: var(--text-primary);
  font-size: 16px;
}

.calendar-page :deep(.fc .fc-col-header-cell-cushion) {
  color: var(--text-secondary);
}

.calendar-page :deep(.fc .fc-daygrid-day-number) {
  color: var(--text-primary);
}

.calendar-page :deep(.fc .fc-event) {
  cursor: pointer;
  font-size: 12px;
}

.calendar-page :deep(.fc .fc-list-event td) {
  color: var(--text-primary);
}

.calendar-page :deep(.fc .fc-list-empty) {
  color: var(--text-secondary);
}

.calendar-page :deep(.fc-scrollgrid) {
  border-color: var(--border-subtle);
}
</style>
```

---

### Task 14: Event Detail Modal

**Files:**
- Create: `frontend/src/components/calendar/EventDetailModal.vue`

- [ ] **Step 1: Create detail modal**

```vue
<script setup lang="ts">
import { computed } from "vue";
import {
  NModal,
  NCard,
  NButton,
  NDescriptions,
  NDescriptionsItem,
  NTag,
  NIcon,
  NSpace,
} from "naive-ui";
import { CreateOutline, TrashOutline } from "@vicons/ionicons5";
import type { CalendarEvent } from "@/types/calendar";

const props = defineProps<{
  show: boolean;
  event: CalendarEvent | null;
}>();

const emit = defineEmits<{
  "update:show": [value: boolean];
  edit: [];
  delete: [id: string];
}>();

const isCronJob = computed(() => props.event?.source === "cron_job");

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :title="event?.title ?? '事件详情'"
    style="max-width: 480px"
    :mask-closable="true"
    @update:show="emit('update:show', $event)"
  >
    <template v-if="event" #header-extra>
      <NTag v-if="isCronJob" type="warning" size="small" :bordered="false" round>
        定时任务
      </NTag>
    </template>

    <NDescriptions v-if="event" label-placement="left" :column="1" bordered size="small">
      <NDescriptionsItem label="开始时间">
        {{ formatTime(event.start_time) }}
      </NDescriptionsItem>
      <NDescriptionsItem v-if="event.end_time" label="结束时间">
        {{ formatTime(event.end_time) }}
      </NDescriptionsItem>
      <NDescriptionsItem v-if="event.all_day" label="全天">
        <NTag size="small" :bordered="false" round>全天</NTag>
      </NDescriptionsItem>
      <NDescriptionsItem v-if="event.location" label="地点">
        {{ event.location }}
      </NDescriptionsItem>
      <NDescriptionsItem v-if="event.description" label="描述">
        {{ event.description }}
      </NDescriptionsItem>
    </NDescriptions>

    <template #action>
      <NSpace v-if="event && !isCronJob">
        <NButton type="error" ghost size="small" @click="emit('delete', event.id)">
          <template #icon>
            <NIcon :component="TrashOutline" size="16" />
          </template>
          删除
        </NButton>
        <NButton type="primary" size="small" @click="emit('edit')">
          <template #icon>
            <NIcon :component="CreateOutline" size="16" />
          </template>
          编辑
        </NButton>
      </NSpace>
      <NButton v-else size="small" @click="emit('update:show', false)">关闭</NButton>
    </template>
  </NModal>
</template>
```

---

### Task 15: Event Form Modal

**Files:**
- Create: `frontend/src/components/calendar/EventFormModal.vue`

- [ ] **Step 1: Create form modal**

```vue
<script setup lang="ts">
import { ref, watch, computed } from "vue";
import {
  NModal,
  NCard,
  NForm,
  NFormItem,
  NInput,
  NDatePicker,
  NButton,
  NSelect,
  NSwitch,
  NIcon,
  useMessage,
} from "naive-ui";
import { useCalendarStore } from "@/stores/calendar";
import type { CalendarEvent } from "@/types/calendar";

const props = defineProps<{
  show: boolean;
  event: CalendarEvent | null;
  defaults?: { start_time?: string; end_time?: string };
}>();

const emit = defineEmits<{
  "update:show": [value: boolean];
  saved: [];
}>();

const store = useCalendarStore();
const message = useMessage();
const saving = ref(false);

const isEdit = computed(() => !!props.event);

const title = ref("");
const description = ref("");
const startTime = ref<number | null>(null);
const endTime = ref<number | null>(null);
const allDay = ref(false);
const location = ref("");
const color = ref<string | null>(null);

const colorOptions = [
  { label: "默认蓝", value: "#3b82f6" },
  { label: "绿色", value: "#10b981" },
  { label: "橙色", value: "#f59e0b" },
  { label: "红色", value: "#ef4444" },
  { label: "紫色", value: "#8b5cf6" },
  { label: "粉色", value: "#ec4899" },
];

watch(
  () => props.show,
  (visible) => {
    if (!visible) return;
    if (props.event) {
      title.value = props.event.title;
      description.value = props.event.description ?? "";
      startTime.value = props.event.start_time ? new Date(props.event.start_time).getTime() : null;
      endTime.value = props.event.end_time ? new Date(props.event.end_time).getTime() : null;
      allDay.value = props.event.all_day;
      location.value = props.event.location ?? "";
      color.value = props.event.color;
    } else {
      title.value = "";
      description.value = "";
      startTime.value = props.defaults?.start_time ? new Date(props.defaults.start_time).getTime() : null;
      endTime.value = props.defaults?.end_time ? new Date(props.defaults.end_time).getTime() : null;
      allDay.value = false;
      location.value = "";
      color.value = null;
    }
  },
);

async function handleSubmit() {
  if (!title.value.trim()) {
    message.warning("请输入事件标题");
    return;
  }
  if (!startTime.value) {
    message.warning("请选择开始时间");
    return;
  }

  saving.value = true;
  try {
    if (isEdit.value && props.event) {
      await store.updateEvent(props.event.id, {
        title: title.value,
        description: description.value || null,
        start_time: new Date(startTime.value).toISOString(),
        end_time: endTime.value ? new Date(endTime.value).toISOString() : null,
        all_day: allDay.value,
        location: location.value || null,
        color: color.value,
      });
      message.success("事件已更新");
    } else {
      await store.createEvent({
        title: title.value,
        description: description.value || undefined,
        start_time: new Date(startTime.value).toISOString(),
        end_time: endTime.value ? new Date(endTime.value).toISOString() : undefined,
        all_day: allDay.value,
        location: location.value || undefined,
        color: color.value ?? undefined,
      });
      message.success("事件已创建");
    }
    emit("saved");
    emit("update:show", false);
    // 刷新当前视图
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
    store.fetchEvents(start, end);
  } catch (e) {
    message.error(e instanceof Error ? e.message : "操作失败");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <NModal
    :show="show"
    preset="card"
    :title="isEdit ? '编辑事件' : '新建事件'"
    style="max-width: 480px"
    :mask-closable="true"
    @update:show="emit('update:show', $event)"
  >
    <NForm label-placement="left" label-width="80" size="small">
      <NFormItem label="标题">
        <NInput v-model:value="title" placeholder="事件标题" />
      </NFormItem>
      <NFormItem label="开始时间">
        <NDatePicker
          v-model:value="startTime"
          type="datetime"
          clearable
          style="width: 100%"
        />
      </NFormItem>
      <NFormItem label="结束时间">
        <NDatePicker
          v-model:value="endTime"
          type="datetime"
          clearable
          style="width: 100%"
        />
      </NFormItem>
      <NFormItem label="全天">
        <NSwitch v-model:value="allDay" />
      </NFormItem>
      <NFormItem label="地点">
        <NInput v-model:value="location" placeholder="可选" />
      </NFormItem>
      <NFormItem label="描述">
        <NInput
          v-model:value="description"
          type="textarea"
          :rows="2"
          placeholder="可选"
        />
      </NFormItem>
      <NFormItem label="颜色">
        <NSelect
          v-model:value="color"
          :options="colorOptions"
          clearable
          placeholder="默认"
        />
      </NFormItem>
    </NForm>

    <template #action>
      <NButton @click="emit('update:show', false)">取消</NButton>
      <NButton type="primary" :loading="saving" @click="handleSubmit">
        {{ isEdit ? "保存" : "创建" }}
      </NButton>
    </template>
  </NModal>
</template>
```

---

### Task 16: Router + Navigation Integration

**Files:**
- Modify: `frontend/src/router/index.ts`
- Modify: `frontend/src/components/common/AppHeader.vue`

- [ ] **Step 1: Add /calendar route**

在 `frontend/src/router/index.ts` 的 routes 数组中添加：

```typescript
{
  path: "/calendar",
  name: "Calendar",
  component: () => import("@/views/CalendarView.vue"),
},
```

- [ ] **Step 2: Add calendar icon to AppHeader**

在 `frontend/src/components/common/AppHeader.vue` 中：

1. 添加 import:
```typescript
import { CalendarOutline } from "@vicons/ionicons5";
```

2. 添加导航函数:
```typescript
function goToCalendar() {
  router.push("/calendar");
}
```

3. 在 NotificationBell 之后、ThemeToggle 之前添加按钮:
```vue
<NButton
  text
  class="text-[var(--text-secondary)] hover:text-[var(--color-primary)]"
  @click="goToCalendar"
>
  <template #icon>
    <NIcon :component="CalendarOutline" size="20" />
  </template>
</NButton>
```

---

### Task 17: Build Verification

- [ ] **Step 1: Build backend**

```bash
cd backend && pnpm build
```

Expected: 编译成功，无类型错误。

- [ ] **Step 2: Build frontend**

```bash
cd frontend && pnpm build
```

Expected: 编译成功，无类型错误。

- [ ] **Step 3: Run lint**

```bash
cd backend && pnpm lint
cd frontend && pnpm lint
```

Expected: 无 lint 错误（或仅与新增代码无关的既有 warning）。

---

### Task 18: Functional Testing with Playwright

- [ ] **Step 1: Start dev servers**

```bash
./dev.sh
```

- [ ] **Step 2: Test calendar page loads**

使用 Playwright 打开 `https://localhost:3000/calendar`，验证日历页面正常渲染，FullCalendar 组件可见。

- [ ] **Step 3: Test navigation**

验证 AppHeader 中日历图标可点击，跳转到 /calendar 页面。验证返回按钮回到首页。

- [ ] **Step 4: Test event creation**

点击"新建事件"按钮，填写表单（标题、时间、地点），提交后验证事件出现在日历上。

- [ ] **Step 5: Test event detail**

点击日历上的事件，验证详情弹窗显示正确信息（标题、时间、地点、描述）。

- [ ] **Step 6: Test event editing**

在详情弹窗中点击"编辑"，修改标题或时间，保存后验证更新生效。

- [ ] **Step 7: Test event deletion**

在详情弹窗中点击"删除"，确认后验证事件从日历上消失。

- [ ] **Step 8: Test cron job events**

验证已启用的定时任务在日历上以橙色显示，点击可查看详情但不可编辑/删除。

- [ ] **Step 9: Test date selection**

在日历上拖选时间段，验证自动弹出创建事件表单，且时间预填充。

- [ ] **Step 10: Test view switching**

验证月/周/日/列表视图切换正常工作。

- [ ] **Step 11: Test AI agent calendar tool**

通过聊天发送"明天下午3点提醒我开会"，验证 AI 调用 calendar 工具创建事件。刷新日历页面验证事件出现。
