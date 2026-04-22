import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

export enum MemoryType {
  FACT = 'fact',
  PREFERENCE = 'preference',
  EVENT = 'event',
}

@Entity('memories')
export class MemoryEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column('text')
  content: string;

  @Column({ type: 'enum', enum: MemoryType })
  type: MemoryType;

  @Column({ nullable: true })
  source_session_id: string;

  @Column({ nullable: true })
  agent_id: string;

  @Column('float')
  importance: number;

  @CreateDateColumn()
  created_at: Date;

  @Column({ type: 'timestamp' })
  last_accessed: Date;
}
