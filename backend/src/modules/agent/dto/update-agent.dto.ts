import { IsString, IsOptional, IsArray } from 'class-validator';

export class UpdateAgentDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  @IsOptional()
  system_prompt?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  traits?: string[];
}
