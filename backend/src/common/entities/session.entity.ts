import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany, ManyToOne, JoinColumn } from 'typeorm';

@Entity('sessions')
export class SessionEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ default: false })
  is_pinned: boolean;

  @Column({ nullable: true })
  agent_id: string;

  @Column('simple-json', { nullable: true })
  rule_ids: string[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany('MessageEntity', 'session')
  messages: any[];

  @ManyToOne('AgentEntity', 'sessions')
  @JoinColumn({ name: 'agent_id' })
  agent: any;
}
