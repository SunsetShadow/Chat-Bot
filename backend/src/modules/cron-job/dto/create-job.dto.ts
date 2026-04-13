import { IsString, IsOptional, IsEnum, IsInt, IsArray, Min, IsDateString } from 'class-validator';

export class CreateJobDto {
  @IsString()
  instruction: string;

  @IsEnum(['cron', 'every', 'at'])
  type: 'cron' | 'every' | 'at';

  @IsString()
  @IsOptional()
  cron?: string;

  @IsInt()
  @Min(1000)
  @IsOptional()
  every_ms?: number;

  @IsDateString()
  @IsOptional()
  at?: string;

  @IsString()
  @IsOptional()
  timezone?: string;

  @IsArray()
  @IsOptional()
  allowed_tools?: string[];

  @IsInt()
  @IsOptional()
  timeout_ms?: number;

  @IsInt()
  @IsOptional()
  max_retries?: number;
}
