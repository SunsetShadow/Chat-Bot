import { IsString, IsOptional, IsNotEmpty, IsEnum } from 'class-validator';
import { RuleCategory, ConflictStrategy } from '../../../common/entities/rule.entity';

export { RuleCategory, ConflictStrategy };

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
