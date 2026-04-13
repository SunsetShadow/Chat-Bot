import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export type JobType = 'cron' | 'every' | 'at';

@Entity('jobs')
export class JobEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column('text')
  instruction: string;

  @Column('varchar', { length: 10, default: 'cron' })
  type: JobType;

  @Column('varchar', { length: 100, nullable: true })
  cron: string | null;

  @Column('int', { nullable: true })
  every_ms: number | null;

  @Column('timestamp', { nullable: true })
  at: Date | null;

  @Column('varchar', { length: 50, default: 'Asia/Shanghai' })
  timezone: string;

  @Column({ default: true })
  is_enabled: boolean;

  @Column('simple-array', { nullable: true })
  allowed_tools: string[];

  @Column('int', { default: 60000 })
  timeout_ms: number;

  @Column('int', { default: 3 })
  max_retries: number;

  @Column('int', { default: 0 })
  consecutive_failures: number;

  @Column('int', { default: 5 })
  auto_disable_threshold: number;

  @Column('varchar', { nullable: true })
  agent_id: string | null;

  @Column('uuid', { nullable: true })
  created_by_session: string | null;

  @Column('timestamp', { nullable: true })
  last_run: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
