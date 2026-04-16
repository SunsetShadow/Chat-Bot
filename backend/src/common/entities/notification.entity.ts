import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

export type NotificationType = 'cron_job';

@Entity('notifications')
export class NotificationEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column('varchar', { length: 20, default: 'cron_job' })
  type: NotificationType;

  @Column('varchar', { length: 200 })
  title: string;

  @Column('text')
  content: string;

  @Column({ default: false })
  is_read: boolean;

  @Column('uuid', { nullable: true })
  job_id: string | null;

  @Column('uuid', { nullable: true })
  session_id: string | null;

  @CreateDateColumn()
  created_at: Date;
}
