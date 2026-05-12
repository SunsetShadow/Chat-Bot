import { Entity, PrimaryColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('token_usages')
export class TokenUsageEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  @Index()
  session_id: string;

  @Column({ nullable: true })
  agent_id: string;

  @Column()
  model_name: string;

  @Column('int')
  prompt_tokens: number;

  @Column('int')
  completion_tokens: number;

  @Column('int')
  total_tokens: number;

  @Column('decimal', { precision: 10, scale: 6, nullable: true })
  estimated_cost: number;

  @CreateDateColumn()
  @Index()
  created_at: Date;
}
