import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { CronJob } from 'cron';
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
    const where: FindOptionsWhere<CalendarEventEntity> = {};
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
    const escaped = query.replace(/[%_]/g, (c) => '\\' + c);
    return this.eventRepo
      .createQueryBuilder('e')
      .where('e.title ILIKE :q OR e.description ILIKE :q', { q: `%${escaped}%` })
      .orderBy('e.start_time', 'ASC')
      .limit(50)
      .getMany();
  }

  async getCronJobEvents(timeMin: string, timeMax: string): Promise<CalendarEventEntity[]> {
    const jobs = await this.jobService.listJobs();
    const enabledJobs = jobs.filter((j) => j.is_enabled);
    if (enabledJobs.length === 0) return [];
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

  private expandScheduleTimes(job: { type: string; at?: Date | string | null; every_ms?: number | null; cron?: string | null; timezone?: string | null; instruction: string }, start: Date, end: Date): Date[] {
    const times: Date[] = [];
    const maxOccurrences = 50;

    if (job.type === 'at' && job.at) {
      const at = job.at instanceof Date ? job.at : new Date(job.at);
      if (at >= start && at <= end) times.push(at);
    } else if (job.type === 'every' && job.every_ms) {
      let t = new Date(start);
      while (t <= end && times.length < maxOccurrences) {
        t = new Date(t.getTime() + job.every_ms);
        if (t >= start && t <= end) times.push(new Date(t));
      }
    } else if (job.type === 'cron' && job.cron) {
      try {
        const cronJob = new CronJob(job.cron, () => {}, null, false, job.timezone || 'Asia/Shanghai');
        const allDates = cronJob.nextDates(maxOccurrences);
        for (const d of allDates) {
          const jsDate: Date = typeof d.toJSDate === 'function' ? d.toJSDate() : new Date(d as unknown as string);
          if (jsDate > end) break;
          if (jsDate >= start) times.push(jsDate);
        }
      } catch {
        // invalid cron expression, skip
      }
    }

    return times;
  }
}
