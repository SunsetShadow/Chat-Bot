import { IsString, IsOptional, IsNotEmpty, IsEnum } from 'class-validator';
import { RuleCategory, RuleScope } from '../../../common/entities/rule.entity';

export { RuleCategory, RuleScope };

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

  @IsEnum(RuleScope)
  @IsOptional()
  scope?: RuleScope;
}
