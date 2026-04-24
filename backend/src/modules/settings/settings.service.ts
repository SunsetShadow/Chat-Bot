import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import path from 'node:path';
import { SettingEntity } from '../../common/entities/setting.entity';
import { DEFAULT_SKILLS_DIR } from '../skill/skill.types';

const DEFAULT_SETTINGS: Partial<SettingEntity>[] = [
  {
    key: 'sandbox_allowed_dirs',
    value: process.cwd(),
    description: '路径沙箱 — 工具可访问的目录（逗号分隔）',
  },
  {
    key: 'skills_dirs',
    value: DEFAULT_SKILLS_DIR,
    description: 'Skills 目录 — 存放 SKILL.md 技能包的目录（逗号分隔）',
  },
];

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(SettingEntity)
    private settingRepo: Repository<SettingEntity>,
  ) {}

  async onModuleInit() {
    for (const setting of DEFAULT_SETTINGS) {
      const exists = await this.settingRepo.existsBy({ key: setting.key });
      if (!exists) {
        await this.settingRepo.save(this.settingRepo.create(setting));
      }
    }
  }

  async getAll(): Promise<SettingEntity[]> {
    return this.settingRepo.find();
  }

  async get(key: string): Promise<SettingEntity | null> {
    return this.settingRepo.findOneBy({ key });
  }

  async getValue(key: string): Promise<string> {
    const setting = await this.get(key);
    return setting?.value ?? '';
  }

  async update(key: string, value: string): Promise<SettingEntity> {
    let setting = await this.settingRepo.findOneBy({ key });
    if (!setting) {
      setting = this.settingRepo.create({ key, value, description: '' });
    } else {
      setting.value = value;
    }
    return this.settingRepo.save(setting);
  }

  async getAllowedDirs(): Promise<string[]> {
    const value = await this.getValue('sandbox_allowed_dirs');
    if (!value) return [process.cwd()];
    return value.split(',').map(d => path.resolve(d.trim())).filter(Boolean);
  }
}
