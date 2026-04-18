import { Entity, PrimaryColumn, Column } from 'typeorm';

export enum RuleCategory {
  BEHAVIOR = 'behavior',
  FORMAT = 'format',
  CONSTRAINT = 'constraint',
}

export enum ConflictStrategy {
  OVERRIDE = 'override',
  MERGE = 'merge',
  REJECT = 'reject',
}

export enum RuleScope {
  GLOBAL = 'global',
  GENERAL = 'general',
}

@Entity('rules')
export class RuleEntity {
  @PrimaryColumn('varchar')
  id: string;

  @Column()
  name: string;

  @Column('text')
  content: string;

  @Column({ default: true })
  enabled: boolean;

  @Column({ type: 'enum', enum: RuleCategory })
  category: RuleCategory;

  @Column('int')
  priority: number;

  @Column({ type: 'enum', enum: ConflictStrategy })
  conflict_strategy: ConflictStrategy;

  @Column({ default: false })
  is_builtin: boolean;

  @Column({ type: 'enum', enum: RuleScope, default: RuleScope.GENERAL })
  scope: RuleScope;
}
