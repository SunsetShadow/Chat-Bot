import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Res,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { UploadService } from './upload.service';

@Controller('api/v1/upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');
    return this.uploadService.upload(file);
  }

  @Get(':id')
  async getFile(@Param('id') id: string, @Res() res: Response) {
    const { filePath, file } = await this.uploadService.getFile(id);
    res.setHeader('Content-Type', file.content_type);
    res.setHeader('Content-Disposition', `inline; filename="${file.filename}"`);
    res.sendFile(filePath, { root: process.cwd() });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.uploadService.remove(id);
    return { message: 'File deleted' };
  }
}
