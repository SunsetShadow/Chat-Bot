import {
  BadRequestException, Controller, Post, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SpeechService } from './speech.service';

@Controller('api/v1/speech')
export class SpeechController {
  constructor(private readonly speechService: SpeechService) {}

  @Post('asr')
  @UseInterceptors(
    FileInterceptor('audio', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = [
          'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm',
          'audio/mp4', 'audio/x-m4a',
        ];
        cb(null, allowed.includes(file.mimetype) || file.mimetype.startsWith('audio/'));
      },
    }),
  )
  async recognize(@UploadedFile() file?: Express.Multer.File) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('请通过 FormData 的 audio 字段上传音频文件');
    }
    const text = await this.speechService.recognizeBySentence(file);
    return { success: true, data: { text } };
  }
}
