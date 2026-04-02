import { IsString, IsOptional } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @IsOptional()
  title?: string;
}
