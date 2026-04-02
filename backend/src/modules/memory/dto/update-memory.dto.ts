import { IsString, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { MemoryType } from './create-memory.dto';

export class UpdateMemoryDto {
  @IsString()
  @IsOptional()
  content?: string;

  @IsEnum(MemoryType)
  @IsOptional()
  type?: MemoryType;

  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  importance?: number;
}
