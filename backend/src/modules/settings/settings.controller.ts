import { Controller, Get, Put, Body, Param, Query } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { PathSandbox } from '../../modules/langgraph/tools/base/path-sandbox';

@Controller('api/v1/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getAll() {
    return this.settingsService.getAll();
  }

  @Put(':key')
  async update(@Param('key') key: string, @Body() dto: UpdateSettingDto) {
    return this.settingsService.update(key, dto.value);
  }

  @Get('browse')
  async browse(@Query('path') dirPath?: string) {
    const target = dirPath || process.cwd();
    const allowedDirs = await this.settingsService.getAllowedDirs();
    const sandbox = new PathSandbox(allowedDirs);

    const resolved = path.resolve(target);

    if (!sandbox.isAllowed(resolved)) {
      return { currentPath: resolved, directories: [], parentPath: null };
    }

    try {
      const entries = await readdir(resolved, { withFileTypes: true });
      const directories = entries
        .filter(e => e.isDirectory() && !e.name.startsWith('.'))
        .map(e => e.name)
        .sort();

      const parent = path.dirname(resolved);
      const parentPath = parent !== resolved && sandbox.isAllowed(parent) ? parent : null;

      return { currentPath: resolved, directories, parentPath };
    } catch {
      return { currentPath: resolved, directories: [], parentPath: null };
    }
  }
}
