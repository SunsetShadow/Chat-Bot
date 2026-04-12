import { IsString, IsOptional, IsArray, IsNumber } from 'class-validator';

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

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tools?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  skills?: string[];

  @IsString()
  @IsOptional()
  model_name?: string;

  @IsString()
  @IsOptional()
  capabilities?: string;

  @IsOptional()
  enabled?: boolean;

  @IsOptional()
  temperature?: number;

  @IsString()
  @IsOptional()
  avatar?: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsOptional()
  max_turns?: number;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  handoff_targets?: string[];
}
