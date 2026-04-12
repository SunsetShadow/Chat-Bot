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

  @Column({ default: false })
  is_builtin: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany('SessionEntity', 'agent')
  sessions: any[];
}
