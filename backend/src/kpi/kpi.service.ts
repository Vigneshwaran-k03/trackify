import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Kpi } from './kpi.entity';
import { Kra } from '../kra/kra.entity';
import { UsersService } from '../users/users.service';
import { KpiLog } from './kpi-log.entity';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface CreateKpiDto {
  name: string;
  def: string;
  kra_id: number;
  due_date: Date;
  scoring_method: string;
  target?: number | null;
}

export interface UpdateKpiDto {
  name?: string;
  def?: string;
  due_date?: Date;
  scoring_method?: string;
  target?: number | null;
  score?: number | null;
  comments?: string | null;
}

@Injectable()
export class KpiService {
  constructor(
    @InjectRepository(Kpi)
    private readonly kpiRepo: Repository<Kpi>,
    @InjectRepository(Kra)
    private readonly kraRepo: Repository<Kra>,
    @InjectRepository(KpiLog)
    private readonly kpiLogRepo: Repository<KpiLog>,
    private readonly usersService: UsersService,
  ) {}

  async createKpi(dto: CreateKpiDto, user: any) {
    const roleLower = (user.role || '').toLowerCase();
    if (!['manager', 'employee'].includes(roleLower)) {
      throw new ForbiddenException('Only Manager and Employee can create KPI');
    }
    const { name, def, kra_id, due_date, scoring_method, target } = dto;
    if (!name || !def || !kra_id || !due_date || !scoring_method) {
      throw new BadRequestException('name, def, kra_id, due_date, scoring_method are required');
    }

    const kra = await this.kraRepo.findOne({ where: { kra_id: kra_id } });
    if (!kra) throw new BadRequestException('KRA not found');

    const userDetails = await this.usersService.findByEmail(user.email);
    if (!userDetails) throw new BadRequestException('User not found');

    if (roleLower === 'manager') {
      // Ensure manager has access to this KRA
      if (!(kra.dept === userDetails.dept || kra.manager_name === userDetails.name)) {
        throw new ForbiddenException('KRA not accessible to this manager');
      }
    } else if (roleLower === 'employee') {
      if (kra.employee_name !== userDetails.name) {
        throw new ForbiddenException('KRA not assigned to this employee');
      }
    }

    const rec = this.kpiRepo.create({
      name,
      def,
      kra_name: kra.name,
      kra_id: kra.kra_id,
      due_date,
      scoring_method,
      target: typeof target === 'number' ? target : null,
      created_by: userDetails.name,
      kpi_status: (new Date(String(due_date)) < new Date(new Date().toDateString())) ? 'End' : 'Active',
    }) as Kpi;

    const saved: Kpi = await this.kpiRepo.save(rec as Kpi);

    // initial snapshot log with version 0
    const snapshot = this.kpiLogRepo.create({
      kpi_id: saved.id,
      version: 0,
      kpi_name: saved.name,
      kra_name: kra.name,
      kra_id: kra.kra_id,
      target: saved.target ?? null,
      score: saved.score ?? null,
      comments: saved.comments ?? null,
      created_by: userDetails.name || null,
      kra_creator_name: kra.created_by || null,
      dept: kra.dept || null,
      updated_by: userDetails.name,
      due_date: saved.due_date as any,
      changes: null,
    } as any);
    await this.kpiLogRepo.save(snapshot);

    return saved;
  }

  async updateKpi(id: number, dto: UpdateKpiDto, user: any) {
    const roleLower = (user.role || '').toLowerCase();
    if (!['manager', 'employee'].includes(roleLower)) {
      throw new ForbiddenException('Only Manager and Employee can update KPI');
    }

    const kpi = await this.kpiRepo.findOne({ where: { id } });
    if (!kpi) throw new BadRequestException('KPI not found');

    const kra = await this.kraRepo.findOne({ where: { kra_id: kpi.kra_id } });
    if (!kra) throw new BadRequestException('KRA not found');

    const userDetails = await this.usersService.findByEmail(user.email);
    if (!userDetails) throw new BadRequestException('User not found');

    if (roleLower === 'manager') {
      if (!(kra.dept === userDetails.dept || kra.manager_name === userDetails.name)) {
        throw new ForbiddenException('KRA not accessible to this manager');
      }
    } else if (roleLower === 'employee') {
      if (kra.employee_name !== userDetails.name) {
        throw new ForbiddenException('KRA not assigned to this employee');
      }
    }

    // Only allow updates on Active KPIs
    if ((kpi.kpi_status || '').toLowerCase() !== 'active') {
      throw new ForbiddenException('Only Active KPIs can be updated');
    }

    // Disallow direct edits of structural fields; require approval flow
    const forbiddenKeys: (keyof UpdateKpiDto)[] = ['name', 'def', 'due_date', 'scoring_method', 'target'];
    const attemptedForbidden = forbiddenKeys.filter(k => (dto as any)[k] !== undefined);
    if (attemptedForbidden.length > 0) {
      throw new ForbiddenException('Changing name/definition/due date/scoring method/target requires approval request');
    }

    // compute changes
    const changes: Record<string, { from: any; to: any }> = {};
    const applyChange = (field: keyof UpdateKpiDto, current: any, next: any) => {
      if (next !== undefined && current !== next) {
        changes[String(field)] = { from: current ?? null, to: next };
        (kpi as any)[field] = next as any;
      }
    };

    // Only allow score and comments here
    applyChange('score', kpi.score as any, dto.score as any);
    applyChange('comments', kpi.comments as any, dto.comments as any);

    // Refresh status based on possibly updated due_date
    try {
      const due = new Date(String(kpi.due_date));
      const today = new Date(new Date().toDateString());
      kpi.kpi_status = (due < today) ? 'End' : 'Active';
    } catch (_) {}
    const updated: Kpi = await this.kpiRepo.save(kpi as Kpi);

    // write a single log entry if there are changes
    const changedKeys = Object.keys(changes);
    if (changedKeys.length > 0) {
      const last = await this.kpiLogRepo.createQueryBuilder('log')
        .where('log.kpi_id = :id', { id })
        .orderBy('log.version', 'DESC')
        .limit(1)
        .getOne();
      const nextVersion = (last?.version ?? 0) + 1;
      const logRec = this.kpiLogRepo.create({
        kpi_id: id,
        version: nextVersion,
        kpi_name: updated.name,
        kra_name: kra.name,
        kra_id: kra.kra_id,
        target: updated.target ?? null,
        score: updated.score ?? null,
        comments: updated.comments ?? null,
        created_by: updated.created_by || userDetails.name || null,
        kra_creator_name: kra.created_by || null,
        dept: kra.dept || null,
        updated_by: userDetails.name,
        due_date: updated.due_date as any,
        changes: JSON.stringify(changes),
      } as any);
      await this.kpiLogRepo.save(logRec);
    }

    return updated;
  }

  async deleteKpi(id: number, user: any) {
    const roleLower = (user.role || '').toLowerCase();
    if (roleLower !== 'admin') {
      throw new ForbiddenException('Only Admin can delete KPI');
    }

    const kpi = await this.kpiRepo.findOne({ where: { id } });
    if (!kpi) throw new BadRequestException('KPI not found');

    await this.kpiRepo.delete({ id });
    return { success: true } as any;
  }

  async findByDepartment(dept: string) {
    // KPI does not store department directly; derive via related KRAs
    const kras = await this.kraRepo.find({ where: { dept } });
    if (!kras.length) return [];
    const kraIds = kras.map(k => k.kra_id);
    return this.kpiRepo.find({ where: { kra_id: In(kraIds) } });
  }

  async getAvailableKras(user: any) {
    const roleLower = (user.role || '').toLowerCase();
    const userDetails = await this.usersService.findByEmail(user.email);
    if (!userDetails) throw new BadRequestException('User not found');

    if (roleLower === 'manager') {
      // Only KRAs assigned to this manager by Admin (exclude manager self-created)
      // Criteria: manager_name == manager's name AND created_by != manager's name
      const all = await this.kraRepo.find({ where: { manager_name: userDetails.name } });
      return all.filter(k => (k.created_by || '').toLowerCase() !== (userDetails.name || '').toLowerCase());
    }
    if (roleLower === 'employee') {
      return this.kraRepo.find({ where: { employee_name: userDetails.name } });
    }
    throw new ForbiddenException('Role not supported');
  }

  async listMyKpis(user: any, status?: string) {
    const userDetails = await this.usersService.findByEmail(user.email);
    if (!userDetails) throw new BadRequestException('User not found');
    const where: any = { created_by: userDetails.name };
    const s = (status || '').toLowerCase();
    if (s === 'active') where.kpi_status = 'Active';
    else if (s === 'end') where.kpi_status = 'End';
    // if 'all' or empty -> no extra filter
    return this.kpiRepo.find({ where, order: { due_date: 'ASC' } });
  }

  async getLogs(query: { dept?: string; manager?: string; employee?: string }, user: any) {
    const roleLower = (user.role || '').toLowerCase();
    const userDetails = await this.usersService.findByEmail(user.email);
    if (!userDetails) throw new BadRequestException('User not found');

    const qb = this.kpiLogRepo.createQueryBuilder('log');

    if (roleLower === 'admin') {
      if (query.dept) qb.andWhere('log.dept = :dept', { dept: query.dept });
      if (query.employee) {
        qb.andWhere('log.created_by = :e', { e: query.employee });
      } else if (query.manager) {
        qb.andWhere('log.created_by = :m', { m: query.manager });
      }
    } else if (roleLower === 'manager') {
      // Manager views:
      // - My Log (no employee specified): only logs updated by this manager
      // - Employee Log (employee specified): restrict to manager-accessible scope and the selected employee
      if (query.employee) {
        qb.andWhere('(log.kra_creator_name = :m OR log.dept = :d)', { m: userDetails.name, d: userDetails.dept });
        qb.andWhere('log.created_by = :e', { e: query.employee });
      } else {
        qb.andWhere('log.created_by = :me', { me: userDetails.name });
      }
    } else if (roleLower === 'employee') {
      qb.andWhere('log.created_by = :e', { e: userDetails.name });
    } else {
      throw new ForbiddenException('Role not supported');
    }

    // only active KPIs logs (by due_date >= today)
    const today = new Date(new Date().toDateString());
    qb.andWhere('log.due_date >= :today', { today: today.toISOString().slice(0, 10) });
    qb.orderBy('log.updated_at', 'DESC');
    return qb.getMany();
  }

  @Cron(CronExpression.EVERY_DAY_AT_1AM)
  async purgeExpiredLogs() {
    const today = new Date(new Date().toDateString());
    await this.kpiLogRepo.createQueryBuilder()
      .delete()
      .from(KpiLog)
      .where('due_date < :today', { today: today.toISOString().slice(0, 10) })
      .execute();
  }
}
