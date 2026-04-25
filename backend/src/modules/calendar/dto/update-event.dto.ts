import {
  IsString,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';

export class UpdateEventDto {
  @IsString()
  @IsOptional()
  @MaxLength(200)
  title?: string;

  @IsString()
  @IsOptional()
  description?: string | null;

  @IsDateString()
  @IsOptional()
  start_time?: string;

  @IsDateString()
  @IsOptional()
  end_time?: string | null;

  @IsBoolean()
  @IsOptional()
  all_day?: boolean;

  @IsString()
  @IsOptional()
  color?: string | null;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  location?: string | null;

  @IsInt()
  @IsOptional()
  @Min(0)
  remind_before_ms?: number | null;

  @IsString()
  @IsOptional()
  recurrence_rule?: string | null;
}
