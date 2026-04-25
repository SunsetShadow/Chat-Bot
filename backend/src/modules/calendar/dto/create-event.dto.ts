import {
  IsString,
  IsOptional,
  IsDateString,
  IsBoolean,
  IsInt,
  Min,
  MaxLength,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsDateString()
  start_time: string;

  @IsDateString()
  @IsOptional()
  end_time?: string;

  @IsBoolean()
  @IsOptional()
  all_day?: boolean;

  @IsString()
  @IsOptional()
  color?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  location?: string;

  @IsInt()
  @IsOptional()
  @Min(0)
  remind_before_ms?: number;

  @IsString()
  @IsOptional()
  recurrence_rule?: string;
}
