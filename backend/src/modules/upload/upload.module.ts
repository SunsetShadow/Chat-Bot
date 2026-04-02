import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { AppConfigService } from '../../config/config.service';

@Module({
  imports: [ConfigModule],
  controllers: [UploadController],
  providers: [UploadService, AppConfigService],
  exports: [UploadService],
})
export class UploadModule {}
