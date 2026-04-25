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
