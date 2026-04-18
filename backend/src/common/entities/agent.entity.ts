import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';

@Entity('agents')
export class AgentEntity {
  @PrimaryColumn('varchar')
  id: string;

  @Column()
  name: string;

  @Column('text')
  description: string;

  @Column('text')
  system_prompt: string;

  @Column('simple-array')
  traits: string[];

  @Column('simple-array', { default: '' })
  tools: string[];

  @Column('simple-array', { default: '' })
  skills: string[];

  @Column({ nullable: true })
  model_name: string;

  @Column('text', { default: '' })
  capabilities: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ nullable: true, type: 'decimal' })
  temperature: number;

  @Column({ nullable: true })
  avatar: string;

  @Column({ nullable: true })
  category: string;

  @Column({ nullable: true })
  max_turns: number;

  @Column('simple-array', { default: '' })
  handoff_targets: string[];

  /** true = 独立运行，不经过 Supervisor 编排 */
  @Column({ default: false })
  standalone: boolean;

  /** 该 Agent 启用的 general 规则 ID 列表 */
  @Column('simple-array', { default: '' })
  rule_ids: string[];

  @Column({ default: false })
  is_builtin: boolean;

  /** true = 系统核心 Agent（超级助手、定时任务执行器），不可编辑/删除/复制 */
  @Column({ default: false })
  is_system: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany('SessionEntity', 'agent')
  sessions: any[];
}
