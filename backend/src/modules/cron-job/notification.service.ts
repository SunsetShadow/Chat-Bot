import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { NotificationEntity } from '../../common/entities/notification.entity';

@Injectable()
export class NotificationService {
  constructor(
    @InjectRepository(NotificationEntity)
    private notifRepo: Repository<NotificationEntity>,
  ) {}

  async create(input: {
    type?: 'cron_job';
    title: string;
    content: string;
    job_id?: string;
    session_id?: string;
  }): Promise<NotificationEntity> {
    return this.notifRepo.save(
      this.notifRepo.create({ id: uuidv4(), ...input }),
    );
  }

  async findAll(page = 1, pageSize = 20) {
    const [data, total] = await this.notifRepo.findAndCount({
      order: { created_at: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });
    return { data, total, page, page_size: pageSize };
  }

  async getUnreadCount(): Promise<number> {
    return this.notifRepo.count({ where: { is_read: false } });
  }

  async markAsRead(id: string): Promise<void> {
    await this.notifRepo.update(id, { is_read: true });
  }

  async markAllRead(): Promise<void> {
    await this.notifRepo.update({ is_read: false }, { is_read: true });
  }
}
