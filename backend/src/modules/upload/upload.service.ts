import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';
import { AppConfigService } from '../../config/config.service';

export interface UploadedFile {
  id: string;
  filename: string;
  type: 'image' | 'document';
  url: string;
  size: number;
  content_type: string;
}

@Injectable()
export class UploadService {
  private files = new Map<string, UploadedFile>();

  constructor(private configService: AppConfigService) {
    this.ensureUploadDir();
  }

  private async ensureUploadDir() {
    await fs.mkdir(this.configService.uploadDir, { recursive: true });
  }

  async upload(file: Express.Multer.File): Promise<UploadedFile> {
    const allowedTypes = [...this.configService.allowedImageTypes, ...this.configService.allowedDocTypes];

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(`File type ${file.mimetype} not allowed`);
    }

    if (file.size > this.configService.maxFileSize) {
      throw new BadRequestException(`File size exceeds ${this.configService.maxFileSize} bytes`);
    }

    const fileId = `att_${uuidv4().replace(/-/g, '').slice(0, 12)}`;
    const isImage = this.configService.allowedImageTypes.includes(file.mimetype);

    const uploadedFile: UploadedFile = {
      id: fileId,
      filename: file.originalname,
      type: isImage ? 'image' : 'document',
      url: `/api/v1/upload/${fileId}`,
      size: file.size,
      content_type: file.mimetype,
    };

    const filePath = path.join(this.configService.uploadDir, fileId);
    await fs.writeFile(filePath, file.buffer);

    this.files.set(fileId, uploadedFile);
    return uploadedFile;
  }

  async getFile(id: string) {
    const file = this.files.get(id);
    if (!file) throw new NotFoundException(`File ${id} not found`);

    const filePath = path.join(this.configService.uploadDir, id);
    return { filePath, file };
  }

  async remove(id: string): Promise<void> {
    this.files.get(id); // validates existence, throws if not found
    const filePath = path.join(this.configService.uploadDir, id);
    await fs.unlink(filePath);
    this.files.delete(id);
  }
}
