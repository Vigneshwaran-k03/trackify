import { Injectable } from '@nestjs/common';
import { NotificationService } from '../notification/notification.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewEntity } from './review.entity';

export interface CreateReviewDto {
  employee_id: number;
  employee_name: string;
  dept?: string | null;
  role?: string | null;
  kra_name: string;
  kra_id: number;
  score: number;
  comment?: string | null;
  review_at: Date | string;
}

@Injectable()
export class ReviewService {
  constructor(
    @InjectRepository(ReviewEntity)
    private readonly repo: Repository<ReviewEntity>,
    private readonly notification: NotificationService,
  ) {}

  async create(dto: CreateReviewDto, user: any) {
    const entity = this.repo.create({
      employee_id: Number(dto.employee_id),
      employee_name: dto.employee_name,
      dept: dto.dept ?? null,
      role: dto.role ?? null,
      kra_name: dto.kra_name,
      kra_id: Number(dto.kra_id),
      score: Number(dto.score),
      comment: dto.comment ?? null,
      created_by: String(user?.username || user?.name || user?.email || ''),
      updated_by: String(user?.username || user?.name || user?.email || ''),
      review_at: new Date(dto.review_at),
    });
    const saved = await this.repo.save(entity);
    try {
      const actor = String(user?.username || user?.name || user?.email || '');
      const msg = `${actor} reviewed KRA "${saved.kra_name}" for ${saved.employee_name} with score ${saved.score}`;
      this.notification.sendSlack(msg);
    } catch (_) {}
    return saved;
  }

  async listByEmployee(employeeId: number) {
    return this.repo.find({ where: { employee_id: employeeId }, order: { review_at: 'DESC' } });
  }

  async listByEmployeeAndMonth(employeeId: number, year: number, month: number) {
    const start = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return this.repo.createQueryBuilder('r')
      .where('r.employee_id = :employeeId', { employeeId })
      .andWhere('r.review_at BETWEEN :start AND :end', { start, end })
      .orderBy('r.review_at', 'DESC')
      .getMany();
  }

  async listByKra(kraId: number, employeeId?: number) {
    const qb = this.repo.createQueryBuilder('r').where('r.kra_id = :kraId', { kraId });
    if (employeeId) qb.andWhere('r.employee_id = :employeeId', { employeeId });
    return qb.orderBy('r.review_at', 'DESC').getMany();
  }

  async listByCreator(createdBy: string) {
    return this.repo.createQueryBuilder('r')
      .where('LOWER(r.created_by) = LOWER(:createdBy)', { createdBy })
      .orderBy('r.review_at', 'DESC')
      .getMany();
  }

  async updateReview(id: number, patch: Partial<Pick<ReviewEntity, 'score'|'comment'|'review_at'|'updated_by'>>, user: any) {
    const entity = await this.repo.findOne({ where: { id } });
    if (!entity) return null;
    const updater = String(user?.username || user?.name || user?.email || '');
    entity.score = (patch.score ?? entity.score) as number;
    entity.comment = (patch.comment ?? entity.comment) as any;
    entity.review_at = patch.review_at ? new Date(patch.review_at as any) : entity.review_at;
    entity.updated_by = updater;
    return this.repo.save(entity);
  }
}
