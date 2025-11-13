import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Kpi } from '../kpi/kpi.entity';
import { Kra } from '../kra/kra.entity';
import { UsersService } from '../users/users.service';
import { KpiLog } from '../kpi/kpi-log.entity';

export interface AddScoreDto {
  kpi_id: number;
  comments?: string;
  score: number; // raw score as per KPI's scoring_method
}

@Injectable()
export class ScoringService {
  constructor(
    @InjectRepository(Kpi)
    private readonly kpiRepo: Repository<Kpi>,
    @InjectRepository(Kra)
    private readonly kraRepo: Repository<Kra>,
    @InjectRepository(KpiLog)
    private readonly kpiLogRepo: Repository<KpiLog>,
    private readonly usersService: UsersService,
  ) {}

  private normalizeToPercentage(scoring_method: string, value: number | null | undefined): number | null {
    if (value == null || Number.isNaN(Number(value))) return null;
    const v = Number(value);
    switch (scoring_method) {
      case 'Percentage':
        return Math.max(0, Math.min(100, v));
      case 'Scale (1-5)':
        if (v <= 0) return 0;
        if (v >= 5) return 100;
        return (v / 5) * 100;
      case 'Scale (1-10)':
        if (v <= 0) return 0;
        if (v >= 10) return 100;
        return (v / 10) * 100;
      case 'Rating':
        if (v <= 0) return 0;
        if (v >= 5) return 100;
        return (v / 5) * 100;
      default:
        return null;
    }
  }

  async addOrUpdateScore(dto: AddScoreDto, user: any) {
    const { kpi_id, score, comments } = dto;
    if (!kpi_id && kpi_id !== 0) throw new BadRequestException('kpi_id is required');

    const kpi = await this.kpiRepo.findOne({ where: { id: kpi_id } });
    if (!kpi) throw new BadRequestException('KPI not found');

    const kra = await this.kraRepo.findOne({ where: { kra_id: kpi.kra_id } });
    if (!kra) throw new BadRequestException('KRA not found');

    const userDetails = await this.usersService.findByEmail(user.email);
    if (!userDetails) throw new BadRequestException('User not found');

    const roleLower = (user.role || '').toLowerCase();
    if (roleLower === 'manager') {
      if (!(kra.dept === userDetails.dept || kra.manager_name === userDetails.name)) {
        throw new ForbiddenException('KRA not accessible to this manager');
      }
    } else if (roleLower === 'employee') {
      if (kra.employee_name !== userDetails.name) {
        throw new ForbiddenException('KRA not assigned to this employee');
      }
    } else {
      throw new ForbiddenException('Role not supported');
    }

    // Only allow updates on Active KPIs
    if ((kpi.kpi_status || '').toLowerCase() !== 'active') {
      throw new ForbiddenException('Only Active KPIs can be updated');
    }

    // Diff and write score/comments on KPI
    const changes: Record<string, { from: any; to: any }> = {};
    if (comments !== undefined && kpi.comments !== comments) {
      changes['comments'] = { from: kpi.comments ?? null, to: comments };
      kpi.comments = comments ?? null;
    }
    if (score !== undefined && kpi.score !== score) {
      changes['score'] = { from: kpi.score ?? null, to: score };
      kpi.score = score as any;
    }
    const saved = await this.kpiRepo.save(kpi);
    // After saving a score, recompute and persist the KRA's overall score
    await this.updateKraOverallFromScores(kpi.kra_id);

    // Append KPI Log entry if anything changed
    const changedKeys = Object.keys(changes);
    if (changedKeys.length > 0) {
      const last = await this.kpiLogRepo.createQueryBuilder('log')
        .where('log.kpi_id = :id', { id: kpi.id })
        .orderBy('log.version', 'DESC')
        .limit(1)
        .getOne();
      const nextVersion = (last?.version ?? 0) + 1;
      const logRec = this.kpiLogRepo.create({
        kpi_id: kpi.id,
        version: nextVersion,
        kpi_name: kpi.name,
        kra_name: kra.name,
        kra_id: kra.kra_id,
        target: kpi.target ?? null,
        score: kpi.score ?? null,
        comments: kpi.comments ?? null,
        created_by: kpi.created_by || userDetails.name || null,
        kra_creator_name: kra.created_by || null,
        dept: kra.dept || null,
        updated_by: userDetails.name,
        due_date: kpi.due_date as any,
        changes: JSON.stringify(changes),
      } as any);
      await this.kpiLogRepo.save(logRec);
    }
    return saved;
  }

  async getKpiScore(kpi_id: number) {
    const k = await this.kpiRepo.findOne({ where: { id: kpi_id } });
    if (!k) return null;
    return { kpi_id, score: k.score ?? null, comments: k.comments ?? null };
  }

  async listKpisWithScoresByKra(kra_id: number) {
    const kpis = await this.kpiRepo.find({ where: { kra_id }, order: { due_date: 'ASC' } });
    return kpis.map(k => {
      const percentage = this.normalizeToPercentage(k.scoring_method, k.score ?? null);
      return {
        ...k,
        score: k.score ?? null,
        comments: k.comments ?? null,
        percentage,
      };
    });
  }

  async aggregateKraPercentage(kra_id: number) {
    const items = await this.listKpisWithScoresByKra(kra_id);
    const today = new Date(new Date().toDateString());
    const activeOnly = items.filter(i => {
      const status = String(i.kpi_status || '').toLowerCase();
      if (status === 'active') return true;
      try { return new Date(String(i.due_date)) >= today; } catch { return false; }
    });
    const percentages = activeOnly
      .map(i => i.percentage)
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));

    if (percentages.length === 0) return { percentage: 0, count: 0 };
    const sum = percentages.reduce((a, b) => a + b, 0);
    const avg = Math.round((sum / percentages.length) * 100) / 100;
    return { percentage: avg, count: percentages.length };
  }

  private async updateKraOverallFromScores(kra_id: number): Promise<void> {
    const { percentage } = await this.aggregateKraPercentage(kra_id);
    await this.kraRepo.update({ kra_id }, { overall_score: percentage });
  }
}
