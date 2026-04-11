import { IsString, IsOptional, IsNotEmpty, IsEnum, IsInt, Min, Max } from 'class-validator';
import { MemoryType } from '../../../common/entities/memory.entity';

export { MemoryType };

export class CreateMemoryDto {
  @IsString()
  @IsNotEmpty()
  content: string;

  @IsEnum(MemoryType)
  @IsOptional()
  type?: MemoryType;

  @IsString()
  @IsOptional()
  source_session_id?: string;

  @IsInt()
  @Min(1)
  @Max(10)
  @IsOptional()
  importance?: number;
}
