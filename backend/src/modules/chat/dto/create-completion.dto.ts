import { IsString, IsOptional, IsNotEmpty, IsBoolean, IsArray } from 'class-validator';

export class CreateCompletionDto {
  @IsString()
  @IsNotEmpty()
  message: string;

  @IsString()
  @IsOptional()
  session_id?: string;

  @IsBoolean()
  @IsOptional()
  stream?: boolean;

  @IsString()
  @IsOptional()
  model?: string;

  @IsString()
  @IsOptional()
  agent_id?: string;

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  rule_ids?: string[];

  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachment_ids?: string[];

  @IsBoolean()
  @IsOptional()
  web_search?: boolean;

  @IsBoolean()
  @IsOptional()
  thinking?: boolean;

  @IsString()
  @IsOptional()
  tts_session_id?: string;
}
