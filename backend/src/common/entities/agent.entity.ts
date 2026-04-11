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

  @Column({ default: false })
  is_builtin: boolean;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany('SessionEntity', 'agent')
  sessions: any[];
}
