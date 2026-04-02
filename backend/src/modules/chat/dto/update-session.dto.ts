import { IsBoolean } from 'class-validator';

export class UpdateSessionDto {
  @IsBoolean()
  is_pinned: boolean;
}
