import { IsString, IsOptional, IsArray, IsNotEmpty } from 'class-validator';

export class CreateAgentDto {
  @IsString()
  @IsNotEmpty()
  name: string;

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
