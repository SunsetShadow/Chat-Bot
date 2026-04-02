import { IsString, IsOptional, IsNotEmpty, IsEnum } from 'class-validator';

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

export class CreateRuleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  @IsEnum(RuleCategory)
  @IsOptional()
  category?: RuleCategory;
}
