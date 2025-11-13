import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Kra } from './kra.entity';
import { UsersService } from '../users/users.service';
import { NotificationService } from '../notification/notification.service';
import { KraLog } from './kra-log.entity';

export interface CreateKraDto {
  name: string;
  definition: string;
  dept?: string;
  manager_name?: string;
  employee_name?: string;
  scoring_method: string;
  target?: number | null;
}

@Injectable()
export class KraService {
  constructor(
    @InjectRepository(Kra)
    private readonly kraRepo: Repository<Kra>,
    @InjectRepository(KraLog)
    private readonly kraLogRepo: Repository<KraLog>,
    private readonly usersService: UsersService,
    private readonly notification: NotificationService,
  ) {}

  async createKra(createKraDto: CreateKraDto, user: any): Promise<Kra | Kra[]> {
    // Check if user has required role (Admin or Manager) - case-insensitive
    const roleLower = (user.role || '').toLowerCase();
    if (!roleLower || !['admin', 'manager'].includes(roleLower)) {
      throw new ForbiddenException('Only Admin and Manager can create KRA');
    }

    const { name, definition, scoring_method } = createKraDto;

    // Validate required fields
    if (!name || !definition || !scoring_method) {
      throw new BadRequestException('Name, definition, and scoring method are required');
    }

    // Get user details to auto-fill fields
    const userDetails = await this.usersService.findByEmail(user.email);
    if (!userDetails) {
      throw new BadRequestException('User not found');
    }

    let baseData: any = {
      name,
      definition,
      scoring_method,
      created_by: userDetails.name,
    };

    if (typeof createKraDto.target === 'number') {
      baseData.target = createKraDto.target;
    } else if (createKraDto.target === null) {
      baseData.target = null;
    }

    // Handle role-based logic
    if (roleLower === 'manager') {
      // For managers, auto-set dept and keep manager_name null as requested
      baseData.dept = userDetails.dept;
      baseData.manager_name = null;

      // If Assign To is 'All', create one KRA per employee in manager's department
      if ((createKraDto.employee_name || '').toLowerCase() === 'all') {
        const employees = await this.usersService.getEmployeesByDepartment(userDetails.dept);
        const records = employees.map(emp => ({
          ...baseData,
          employee_name: emp.name,
          manager_name: null,
        }));
        const savedMany = await this.kraRepo.save(records);
        // initial logs
        for (const saved of savedMany) {
          const log = this.kraLogRepo.create({
            kra_id: saved.kra_id,
            version: 0,
            kra_name: saved.name,
            dept: saved.dept || null,
            manager_name: saved.manager_name || null,
            employee_name: saved.employee_name || null,
            created_by: saved.created_by || null,
            updated_by: userDetails.name,
            scoring_method: saved.scoring_method,
            target: saved.target ?? null,
            overall_score: saved.overall_score ?? null,
            changes: null,
          } as any);
          await this.kraLogRepo.save(log);
        }
        return savedMany;
      }

      // Otherwise, optional single employee assignment
      if (createKraDto.employee_name) {
        baseData.employee_name = createKraDto.employee_name;
      }
    } else if (roleLower === 'admin') {
      // For admins, dept and manager_name should be provided
      if (createKraDto.dept) {
        baseData.dept = createKraDto.dept;
      } else {
        throw new BadRequestException('Department is required for Admin');
      }

      if (!createKraDto.manager_name) {
        throw new BadRequestException('Manager name is required for Admin');
      }

      // If Manager is 'All', create one KRA per manager in department
      if ((createKraDto.manager_name || '').toLowerCase() === 'all') {
        const managers = await this.usersService.getManagersByDepartment(createKraDto.dept);
        const records = managers.map(mgr => ({
          ...baseData,
          manager_name: mgr.name,
          // employee_name optional if provided by admin (applies same value to all)
          ...(createKraDto.employee_name ? { employee_name: createKraDto.employee_name } : {}),
        }));
        const savedMany = await this.kraRepo.save(records);
        for (const saved of savedMany) {
          const log = this.kraLogRepo.create({
            kra_id: saved.kra_id,
            version: 0,
            kra_name: saved.name,
            dept: saved.dept || null,
            manager_name: saved.manager_name || null,
            employee_name: saved.employee_name || null,
            created_by: saved.created_by || null,
            updated_by: userDetails.name,
            scoring_method: saved.scoring_method,
            target: saved.target ?? null,
            overall_score: saved.overall_score ?? null,
            changes: null,
          } as any);
          await this.kraLogRepo.save(log);
        }
        return savedMany;
      }

      // Otherwise, single manager specified
      baseData.manager_name = createKraDto.manager_name;
      if (createKraDto.employee_name) {
        baseData.employee_name = createKraDto.employee_name;
      }
    }

    const saved = await this.kraRepo.save(baseData);

    // initial snapshot log with version 0
    try {
      const log = this.kraLogRepo.create({
        kra_id: saved.kra_id,
        version: 0,
        kra_name: saved.name,
        dept: saved.dept || null,
        manager_name: saved.manager_name || null,
        employee_name: saved.employee_name || null,
        created_by: saved.created_by || null,
        updated_by: userDetails.name,
        scoring_method: saved.scoring_method,
        target: saved.target ?? null,
        overall_score: saved.overall_score ?? null,
        changes: null,
      } as any);
      await this.kraLogRepo.save(log);
    } catch (_) {}

    // Fire-and-forget Slack notification (best-effort)
    try {
      const dept = saved.dept || userDetails.dept || '';
      if (roleLower === 'admin') {
        const msg = `Admin ${userDetails.name} assigned KRA "${saved.name}" to Manager ${saved.manager_name || '(unspecified)'}${saved.employee_name ? ` and Employee ${saved.employee_name}` : ''} in Dept ${dept}`;
        this.notification.sendSlack(msg);
      } else if (roleLower === 'manager') {
        if (saved.employee_name) {
          const msg = `Manager ${userDetails.name} assigned KRA "${saved.name}" to Employee ${saved.employee_name} in Dept ${dept}`;
          this.notification.sendSlack(msg);
        } else {
          const msg = `Manager ${userDetails.name} created KRA "${saved.name}" in Dept ${dept}`;
          this.notification.sendSlack(msg);
        }
      }
    } catch (_) {}

    return saved;
  }

  async updateAssignmentByAdmin(kra_id: number, changes: { manager_name?: string | null; employee_name?: string | null }, user: any) {
    const roleLower = (user.role || '').toLowerCase();
    if (roleLower !== 'admin') throw new ForbiddenException('Only Admin can update KRA assignments');
    const kra = await this.kraRepo.findOne({ where: { kra_id } });
    if (!kra) throw new BadRequestException('KRA not found');

    const u = await this.usersService.findByEmail(user.email);
    if (!u) throw new BadRequestException('User not found');

    const delta: Record<string, { from: any; to: any }> = {};
    const apply = (key: keyof Kra, toVal: any) => {
      const fromVal: any = (kra as any)[key];
      if (toVal !== undefined && fromVal !== toVal) {
        (kra as any)[key] = toVal;
        delta[String(key)] = { from: fromVal ?? null, to: toVal };
      }
    };
    if ('manager_name' in changes) apply('manager_name', changes.manager_name ?? null);
    if ('employee_name' in changes) apply('employee_name', changes.employee_name ?? null);

    const updated = await this.kraRepo.save(kra);

    // version increment
    const last = await this.kraLogRepo.createQueryBuilder('log')
      .where('log.kra_id = :id', { id: updated.kra_id })
      .orderBy('log.version', 'DESC')
      .limit(1)
      .getOne();
    const nextVersion = (last?.version ?? 0) + 1;

    const log = this.kraLogRepo.create({
      kra_id: updated.kra_id,
      version: nextVersion,
      kra_name: updated.name,
      dept: updated.dept || null,
      manager_name: updated.manager_name || null,
      employee_name: updated.employee_name || null,
      created_by: updated.created_by || null,
      updated_by: u.name,
      scoring_method: updated.scoring_method,
      target: updated.target ?? null,
      overall_score: updated.overall_score ?? null,
      changes: JSON.stringify(delta),
    } as any);
    await this.kraLogRepo.save(log);

    return updated;
  }

  async updateByAdmin(
    kra_id: number,
    changes: { name?: string; definition?: string; target?: number | null; manager_name?: string | null; employee_name?: string | null },
    user: any,
  ) {
    const roleLower = (user.role || '').toLowerCase();
    if (roleLower !== 'admin') throw new ForbiddenException('Only Admin can update KRA');
    const kra = await this.kraRepo.findOne({ where: { kra_id } });
    if (!kra) throw new BadRequestException('KRA not found');

    const u = await this.usersService.findByEmail(user.email);
    if (!u) throw new BadRequestException('User not found');

    const delta: Record<string, { from: any; to: any }> = {};
    const apply = (key: keyof Kra, toVal: any) => {
      const fromVal: any = (kra as any)[key];
      if (toVal !== undefined && fromVal !== toVal) {
        (kra as any)[key] = toVal;
        delta[String(key)] = { from: fromVal ?? null, to: toVal };
      }
    };
    if ('name' in changes) apply('name', changes.name as any);
    if ('definition' in changes) apply('definition', changes.definition as any);
    if ('target' in changes) apply('target', changes.target as any);
    if ('manager_name' in changes) apply('manager_name', (changes.manager_name as any) ?? null);
    if ('employee_name' in changes) apply('employee_name', (changes.employee_name as any) ?? null);

    const updated = await this.kraRepo.save(kra);

    const last = await this.kraLogRepo.createQueryBuilder('log')
      .where('log.kra_id = :id', { id: updated.kra_id })
      .orderBy('log.version', 'DESC')
      .limit(1)
      .getOne();
    const nextVersion = (last?.version ?? 0) + 1;

    const log = this.kraLogRepo.create({
      kra_id: updated.kra_id,
      version: nextVersion,
      kra_name: updated.name,
      dept: updated.dept || null,
      manager_name: updated.manager_name || null,
      employee_name: updated.employee_name || null,
      created_by: updated.created_by || null,
      updated_by: u.name,
      scoring_method: updated.scoring_method,
      target: updated.target ?? null,
      overall_score: updated.overall_score ?? null,
      changes: JSON.stringify(delta),
    } as any);
    await this.kraLogRepo.save(log);

    return updated;
  }

  async getLogs(user: any, filters: { dept?: string; manager?: string; employee?: string; kra_id?: string }) {
    const roleLower = (user?.role || '').toLowerCase();
    const qb = this.kraLogRepo.createQueryBuilder('l');
    // Role-based access: managers limited to their dept
    if (roleLower === 'manager') {
      const u = await this.usersService.findByEmail(user.email);
      if (!u) throw new BadRequestException('User not found');
      if (u.dept) qb.where('l.dept = :dept', { dept: u.dept }); else qb.where('1=0');
    }
    // Admin: no base restriction
    if (filters?.dept) qb.andWhere('l.dept = :fdept', { fdept: filters.dept });
    if (filters?.manager) qb.andWhere('l.manager_name = :fm', { fm: filters.manager });
    if (filters?.employee) qb.andWhere('l.employee_name = :fe', { fe: filters.employee });
    if (filters?.kra_id) qb.andWhere('l.kra_id = :kid', { kid: Number(filters.kra_id) });
    qb.orderBy('l.updated_at', 'DESC');
    return qb.getMany();
  }

  async findAll(): Promise<Kra[]> {
    return this.kraRepo.find({
      order: { created_at: 'DESC' }
    });
  }

  async findById(kra_id: number): Promise<Kra | null> {
    return this.kraRepo.findOne({ where: { kra_id } });
  }

  async findByDepartment(dept: string): Promise<Kra[]> {
    return this.kraRepo.find({
      where: { dept },
      order: { created_at: 'DESC' }
    });
  }

  async deleteByAdmin(kra_id: number, user: any): Promise<void> {
    const roleLower = (user.role || '').toLowerCase();
    if (roleLower !== 'admin') throw new ForbiddenException('Only Admin can delete KRA');
    const kra = await this.kraRepo.findOne({ where: { kra_id } });
    if (!kra) throw new BadRequestException('KRA not found');
    await this.kraRepo.delete(kra_id);
  }
}