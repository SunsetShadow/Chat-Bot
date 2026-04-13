import {
  Column,
  Entity,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { JobEntity } from './job.entity';

export type JobExecutionStatus = 'running' | 'success' | 'failed';

@Entity('job_executions')
export class JobExecutionEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  job_id: string;

  @ManyToOne(() => JobEntity, { onDelete: 'CASCADE' })
  job: JobEntity;

  @Column('varchar', { length: 20, default: 'running' })
  status: JobExecutionStatus;

  @Column('text', { nullable: true })
  result: string | null;

  @Column('text', { nullable: true })
  error: string | null;

  @Column('int', { nullable: true })
  duration_ms: number | null;

  @Column('int', { default: 0 })
  retry_attempt: number;

  @Column('timestamp')
  started_at: Date;

  @Column('timestamp', { nullable: true })
  finished_at: Date | null;
}
