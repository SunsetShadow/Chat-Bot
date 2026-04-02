import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private configService: NestConfigService) {}

  get appName(): string {
    return this.configService.get<string>('APP_NAME', 'Chat Bot API');
  }

  get debug(): boolean {
    return this.configService.get<string>('DEBUG', 'false') === 'true';
  }

  get port(): number {
    return parseInt(this.configService.get<string>('PORT', '8000'), 10);
  }

  get openaiApiKey(): string {
    return this.configService.get<string>('OPENAI_API_KEY', '');
  }

  get openaiBaseUrl(): string {
    return this.configService.get<string>('OPENAI_BASE_URL', '');
  }

  get openaiModel(): string {
    return this.configService.get<string>('OPENAI_MODEL', 'gpt-4o');
  }

  get corsOrigins(): string[] {
    const origins = this.configService.get<string>('CORS_ORIGINS', '');
    if (!origins) return ['http://localhost:3000', 'http://localhost:5173'];
    return origins.split(',').map((o) => o.trim()).filter(Boolean);
  }

  get uploadDir(): string {
    return this.configService.get<string>('UPLOAD_DIR', 'uploads');
  }

  get maxFileSize(): number {
    return parseInt(
      this.configService.get<string>('MAX_FILE_SIZE', String(10 * 1024 * 1024)),
      10,
    );
  }

  get maxFilesPerMessage(): number {
    return parseInt(
      this.configService.get<string>('MAX_FILES_PER_MESSAGE', '5'),
      10,
    );
  }

  get allowedImageTypes(): string[] {
    return ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
  }

  get allowedDocTypes(): string[] {
    return ['application/pdf', 'text/plain', 'text/markdown'];
  }
}
