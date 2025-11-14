import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationEntity } from './notification.entity';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly webhookUrl = process.env.SLACK_WEBHOOK_URL || '';

  constructor(
    @InjectRepository(NotificationEntity)
    private readonly repo: Repository<NotificationEntity>,
  ) {}

  async sendSlack(text: string, blocks?: any): Promise<{ ok: boolean }> {
    try {
      if (!this.webhookUrl) {
        this.logger.warn('SLACK_WEBHOOK_URL not set; skipping Slack notification.');
        return { ok: false };
      }
      const payload: any = { text };
      if (blocks) payload.blocks = blocks;

      // Use global fetch
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      } as any);
      if (!res.ok) {
        const t = await res.text();
        this.logger.error(`Slack webhook failed: ${res.status} ${t}`);
        return { ok: false };
      }
      return { ok: true };
    } catch (e: any) {
      this.logger.error('Error sending Slack notification', e?.stack || e?.message || e);
      return { ok: false };
    }
  }

  async createNotification(params: {
    type: string;
    title: string;
    message?: string | null;
    targetRole: string;
    targetName?: string | null;
    meta?: any | null;
  }): Promise<NotificationEntity> {
    const entity = this.repo.create({
      type: params.type,
      title: params.title,
      message: params.message ?? null,
      targetRole: params.targetRole,
      targetName: params.targetName ?? null,
      meta: params.meta ?? null,
    });
    return this.repo.save(entity);
  }

  async getFeed(targetRole: string, targetName?: string | null, limit = 20): Promise<NotificationEntity[]> {
    const qb = this.repo.createQueryBuilder('n')
      .where('n.targetRole = :role', { role: targetRole })
      .orderBy('n.created_at', 'DESC')
      .limit(limit);
    if (targetName) {
      qb.andWhere('(n.targetName = :name OR n.targetName IS NULL)', { name: targetName });
    }
    return qb.getMany();
  }

  async deleteForTarget(id: number, targetRole: string, targetName?: string | null): Promise<{ affected: number }> {
    const qb = this.repo.createQueryBuilder()
      .delete()
      .from(NotificationEntity)
      .where('id = :id', { id })
      .andWhere('targetRole = :role', { role: targetRole });
    if (targetName) {
      qb.andWhere('(targetName = :name OR targetName IS NULL)', { name: targetName });
    }
    const res = await qb.execute();
    return { affected: res.affected || 0 };
  }
}
