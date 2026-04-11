import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';

export type MessageRole = 'user' | 'assistant' | 'system';

@Entity('messages')
export class MessageEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'enum', enum: ['user', 'assistant', 'system'] })
  role: MessageRole;

  @Column('text')
  content: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne('SessionEntity', 'messages')
  @JoinColumn({ name: 'session_id' })
  session: any;
}
