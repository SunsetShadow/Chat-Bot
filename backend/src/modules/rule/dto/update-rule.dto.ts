import { IsString, IsOptional, IsBoolean, IsEnum } from 'class-validator';
import { RuleCategory, RuleScope } from './create-rule.dto';

export class UpdateRuleDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsBoolean()
  @IsOptional()
  enabled?: boolean;

  @IsEnum(RuleCategory)
  @IsOptional()
  category?: RuleCategory;

  @IsEnum(RuleScope)
  @IsOptional()
  scope?: RuleScope;
}
