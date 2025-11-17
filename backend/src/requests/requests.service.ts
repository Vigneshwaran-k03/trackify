import { Injectable, BadRequestException, ForbiddenException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KpiChangeRequest } from './kpi-change-request.entity';
import { KraChangeRequest } from './kra-change-request.entity';
import { Kpi } from '../kpi/kpi.entity';
import { Kra } from '../kra/kra.entity';
import { KpiLog } from '../kpi/kpi-log.entity';
import { KraLog } from '../kra/kra-log.entity';
import { UsersService } from '../users/users.service';
import { NotificationService } from '../notification/notification.service';
import { MailService } from '../mail/mail.service';

const ALLOWED_FIELDS = new Set(['name', 'def', 'due_date', 'scoring_method', 'target']);

type Role = 'Admin' | 'Manager' | 'Employee';

type CreateReqDTO = {
  kpi_id: number;
  requested_changes?: Record<string, any>;
  request_comment?: string | null;
  action?: 'edit' | 'delete';
};

@Injectable()
export class RequestsService {
  private readonly logger = new Logger(RequestsService.name);

  constructor(
    @InjectRepository(KpiChangeRequest)
    private readonly reqRepo: Repository<KpiChangeRequest>,
    @InjectRepository(KraChangeRequest)
    private readonly kraReqRepo: Repository<KraChangeRequest>,
    @InjectRepository(Kpi)
    private readonly kpiRepo: Repository<Kpi>,
    @InjectRepository(Kra)
    private readonly kraRepo: Repository<Kra>,
    @InjectRepository(KpiLog)
    private readonly kpiLogRepo: Repository<KpiLog>,
    @InjectRepository(KraLog)
    private readonly kraLogRepo: Repository<KraLog>,
    private readonly users: UsersService,
    private readonly notify: NotificationService,
    private readonly mail: MailService,
  ) {}

  private validateChanges(payload: Record<string, any>, action: 'edit' | 'delete') {
    if (action === 'delete') return; // no field validation needed
    if (!payload || typeof payload !== 'object') throw new BadRequestException('requested_changes is required');
    const keys = Object.keys(payload);
    if (keys.length === 0) throw new BadRequestException('No fields to change');
    for (const k of keys) {
      if (!ALLOWED_FIELDS.has(k)) throw new BadRequestException(`Field ${k} not allowed`);
    }
  }

  // ---------------- KRA Requests ----------------
  private validateKraChanges(payload: Record<string, any>) {
    if (!payload || typeof payload !== 'object') throw new BadRequestException('requested_changes is required');
    const keys = Object.keys(payload);
    if (keys.length === 0) throw new BadRequestException('No fields to change');
    const allowed = new Set(['name', 'definition', 'target', 'manager_name', 'employee_name', '_action']);
    for (const k of keys) {
      if (!allowed.has(k)) throw new BadRequestException(`Field ${k} not allowed for KRA changes`);
    }
  }

  async createKraRequest(dto: { kra_id: number; requested_changes: Record<string, any>; request_comment?: string | null; approver_name?: string | null }, authUser: any) {
    const roleLower = (authUser.role || '').toLowerCase();
    if (roleLower !== 'manager') throw new ForbiddenException('Only Manager can request KRA changes');
    if (!dto.kra_id) throw new BadRequestException('kra_id is required');
    this.validateKraChanges(dto.requested_changes || {});

    const kra = await this.kraRepo.findOne({ where: { kra_id: dto.kra_id } });
    if (!kra) throw new BadRequestException('KRA not found');

    const u = await this.users.findByEmail(authUser.email);
    if (!u) throw new BadRequestException('User not found');
    // Manager can request within own dept or owning manager_name
    if (!(kra.dept === u.dept || kra.manager_name === u.name)) throw new ForbiddenException('KRA not accessible to this manager');

    const approver_name = (dto.approver_name || null) as string | null;
    const entity = this.kraReqRepo.create({
      kra_id: kra.kra_id,
      requester_role: 'Manager',
      requester_name: u.name,
      approver_role: 'Admin',
      approver_name,
      requested_changes: JSON.stringify(dto.requested_changes || {}),
      request_comment: dto.request_comment ?? null,
      status: 'Pending',
      kra_name: kra.name,
      dept: kra.dept,
    } as Partial<KraChangeRequest>);

    const saved = await this.kraReqRepo.save(entity);

    // Notify admin audience (Admin broadcast is intentional; keep null)
    try {
      await this.notify.createNotification({
        type: 'kra_change_request',
        title: `KRA change request #${saved.id} for ${kra.name}`,
        message: dto.request_comment || null,
        targetRole: 'Admin',
        targetName: null, // broadcast to all admins
        meta: { requestId: saved.id, kra_id: kra.kra_id },
      });
    } catch (e) {
      this.logger.warn('Failed to create KRA change notification', e?.message || e);
    }

    return saved;
  }

  async listKraRequests(query: any, authUser: any) {
    const roleRaw = (authUser.role || '').trim();
    const roleLc = roleRaw.toLowerCase();
    const role = (roleLc === 'admin' ? 'Admin' : roleLc === 'manager' ? 'Manager' : roleLc === 'employee' ? 'Employee' : roleRaw) as Role;
    const u = await this.users.findByEmail(authUser.email);
    if (!u) throw new BadRequestException('User not found');

    const scope = (query.scope || '').toLowerCase(); // 'mine' | 'inbox'
    const status = (query.status || '').trim();
    const kra_id = query.kra_id ? Number(query.kra_id) : undefined;

    const qb = this.kraReqRepo.createQueryBuilder('r');
    if (role === 'Admin') {
      qb.where('r.approver_role = :ar', { ar: 'Admin' }).andWhere('(r.approver_name = :me)', { me: u.name });
    } else if (role === 'Manager') {
      if (scope === 'mine') qb.where('r.requester_name = :me', { me: u.name });
      else qb.where('1=0'); // managers have no inbox approver role for KRA
    } else {
      throw new ForbiddenException('Role not supported');
    }

    if (status) qb.andWhere('r.status = :st', { st: status });
    if (kra_id) qb.andWhere('r.kra_id = :kid', { kid: kra_id });
    qb.orderBy('r.created_at', 'DESC');
    return qb.getMany();
  }

  async getKraRequest(id: number, _authUser: any) {
    const r = await this.kraReqRepo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Request not found');
    return r;
  }

  async decideKra(id: number, decision: 'approve' | 'reject', comment: string | null, authUser: any) {
    const r = await this.kraReqRepo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Request not found');
    const roleRaw = (authUser.role || '').trim();
    const roleLc = roleRaw.toLowerCase();
    const role = (roleLc === 'admin' ? 'Admin' : roleLc === 'manager' ? 'Manager' : roleLc === 'employee' ? 'Employee' : roleRaw) as Role;
    const u = await this.users.findByEmail(authUser.email);
    if (!u) throw new BadRequestException('User not found');
    if (r.approver_role !== role) throw new ForbiddenException('Not allowed to decide this request');
    if (r.approver_name && r.approver_name !== u.name) throw new ForbiddenException('Not allowed to decide this request');

    if (decision === 'reject') {
      r.status = 'Rejected';
      r.decision_comment = comment || null;
      r.decided_by = u.name;
      r.decided_at = new Date();
      await this.kraReqRepo.save(r);
      await this.notify.createNotification({
        type: 'kra_change_decision',
        title: `KRA request #${r.id} rejected`,
        message: comment || null,
        targetRole: 'Manager',
        targetName: r.requester_name,
        meta: { requestId: r.id, decision: 'Rejected' },
      });
      return { ok: true, status: r.status };
    }

    // Approve: apply only allowed fields and write log or handle delete action
    const kra = await this.kraRepo.findOne({ where: { kra_id: r.kra_id } });
    if (!kra) throw new BadRequestException('KRA not found');
    const requested = JSON.parse(r.requested_changes || '{}');
    this.validateKraChanges(requested);

    // If delete action requested, delete KRA directly
    if (String(requested._action || '').toLowerCase() === 'delete') {
      await this.kraRepo.delete({ kra_id: kra.kra_id });
      r.status = 'Approved';
      r.decision_comment = comment || null;
      r.decided_by = u.name;
      r.decided_at = new Date();
      await this.kraReqRepo.save(r);
      try {
        await this.notify.createNotification({
          type: 'kra_change_decision',
          title: `KRA request #${r.id} approved (KRA deleted)`,
          message: null,
          targetRole: 'Manager',
          targetName: r.requester_name,
          meta: { requestId: r.id, decision: 'Approved', action: 'delete' },
        });
      } catch (_) {}
      return { ok: true, status: r.status };
    }

    const changes: Record<string, { from: any; to: any }> = {};
    
    // Only apply the fields that were actually changed in the request
    const apply = (key: keyof Kra, toVal: any) => {
      // Skip if the field wasn't included in the requested changes
      if (!(key in requested)) return;
      
      const fromVal: any = (kra as any)[key];
      // Only update if the value is different
      if (fromVal !== toVal) {
        changes[String(key)] = { from: fromVal ?? null, to: toVal };
        (kra as any)[key] = toVal;
      }
    };

    // Apply only the fields that were included in the request
    if (requested.name !== undefined) apply('name', requested.name);
    if (requested.definition !== undefined) apply('definition', requested.definition);
    if (requested.target !== undefined) apply('target', requested.target);
    if (requested.manager_name !== undefined) apply('manager_name', requested.manager_name);
    if (requested.employee_name !== undefined) apply('employee_name', requested.employee_name);

    const updated = await this.kraRepo.save(kra);

    // kra log version increment
    const last = await this.kraLogRepo.createQueryBuilder('log')
      .where('log.kra_id = :id', { id: kra.kra_id })
      .orderBy('log.version', 'DESC')
      .limit(1)
      .getOne();
    const nextVersion = (last?.version ?? 0) + 1;

    const logRec = this.kraLogRepo.create({
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
      changes: JSON.stringify(changes),
    } as any);
    await this.kraLogRepo.save(logRec);

    r.status = 'Approved';
    r.decision_comment = comment || null;
    r.decided_by = u.name;
    r.decided_at = new Date();
    await this.kraReqRepo.save(r);

    await this.notify.createNotification({
      type: 'kra_change_decision',
      title: `KRA request #${r.id} approved`,
      message: null,
      targetRole: 'Manager',
      targetName: r.requester_name,
      meta: { requestId: r.id, decision: 'Approved' },
    });

    return { ok: true, status: r.status };
  }
  
  private async resolveApprover(requesterRole: Role, requesterName: string, kra: Kra): Promise<{ approverRole: Role; approverName: string | null; }> {
    if (requesterRole === 'Employee') {
      // route to Manager responsible: kra.manager_name if present; else manager of dept
      const name = kra.manager_name || null;
      return { approverRole: 'Manager', approverName: name } as any;
    }
    if (requesterRole === 'Manager') {
      // route to Admin (no specific name)
      return { approverRole: 'Admin', approverName: null };
    }
    throw new ForbiddenException('Requester role not supported');
  }

  async createRequest(dto: CreateReqDTO & { approver_name?: string | null }, authUser: any) {
    const requesterRoleRaw = (authUser.role || '').trim();
    const requesterRoleLc = requesterRoleRaw.toLowerCase();
    const role: Role = (requesterRoleLc === 'employee' ? 'Employee' : requesterRoleLc === 'manager' ? 'Manager' : requesterRoleRaw) as Role;
    if (!['Employee', 'Manager'].includes(role)) {
      throw new ForbiddenException('Only Employee and Manager can request KPI edits');
    }
    if (!dto.kpi_id) throw new BadRequestException('kpi_id is required');
    const action: 'edit' | 'delete' = (dto.action === 'delete' ? 'delete' : 'edit');
    this.validateChanges(dto.requested_changes || {}, action);

    const kpi = await this.kpiRepo.findOne({ where: { id: dto.kpi_id } });
    if (!kpi) throw new BadRequestException('KPI not found');
    const kra = await this.kraRepo.findOne({ where: { kra_id: kpi.kra_id } });
    if (!kra) throw new BadRequestException('KRA not found');

    // Access control: requester must own the KRA/KPI appropriately
    const u = await this.users.findByEmail(authUser.email);
    if (!u) throw new BadRequestException('User not found');
    if (role === 'Employee') {
      if (kra.employee_name !== u.name) throw new ForbiddenException('KRA not assigned to this employee');
    } else if (role === 'Manager') {
      if (!(kra.dept === u.dept || kra.manager_name === u.name)) throw new ForbiddenException('KRA not accessible to this manager');
    }

    const { approverRole, approverName } = await this.resolveApprover(role, u.name, kra);

    const requesterRoleStrict = role as 'Employee' | 'Manager';
    const approverRoleStrict = (String(approverRole).toLowerCase() === 'manager' ? 'Manager' : 'Admin') as 'Manager' | 'Admin';
    const approverNameOverride = (dto.approver_name && approverRoleStrict === 'Admin') ? String(dto.approver_name) : (approverName ?? null);

    const entity = this.reqRepo.create({
      kpi_id: kpi.id,
      requester_role: requesterRoleStrict,
      requester_name: u.name,
      approver_role: approverRoleStrict,
      approver_name: approverNameOverride ?? null,
      requested_changes: JSON.stringify(dto.requested_changes || {}),
      action,
      request_comment: dto.request_comment ?? null,
      status: 'Pending',
      kra_name: kra.name,
      kra_id: kra.kra_id,
      dept: kra.dept,
    } as Partial<KpiChangeRequest>);

    const saved = await this.reqRepo.save(entity);

    // Notify approver
    try {
      const title = `KPI change request #${saved.id} for ${kpi.name}`;

      // ---- SAFETY: decide exact targetName to store in DB ----
      // If approverRole is Manager, prefer explicit approverName, then kra.manager_name as fallback.
      // If still missing, it will be a broadcast to all managers — log so we can see if it's accidental.
      let notifTargetName: string | null = null;
      if (approverRoleStrict === 'Manager') {
        notifTargetName = approverName || kra.manager_name || null;
        if (!notifTargetName) {
          this.logger.warn(`No manager name resolved for KPI request ${saved.id} (kra_id=${kra.kra_id}). Notification will be broadcast to all managers.`);
        }
      } else {
        // Admin target (approverNameOverride used only when provided)
        notifTargetName = approverNameOverride ?? null;
      }

      await this.notify.createNotification({
        type: 'kpi_change_request',
        title,
        message: dto.request_comment || null,
        targetRole: approverRoleStrict,
        targetName: notifTargetName,
        meta: { requestId: saved.id, kpi_id: kpi.id, kra_id: kra.kra_id, action },
      });

      // Attempt email (best-effort)
      let to = '';
      if (approverRole === 'Manager' && (kra.manager_name || notifTargetName)) {
        const mgrName = notifTargetName || kra.manager_name;
        const mgr = await this.users.findByName(mgrName);
        to = mgr?.email || '';
      } else if (approverRole === 'Admin') {
        // send to any admin? We don't have list; skip email if unknown
      }
      if (to) {
        await this.mail.sendMail({
          to,
          subject: title,
          text: `A KPI change request was created by ${u.name} for KPI ${kpi.name}. Request ID: ${saved.id}.`,
        });
      }
    } catch (e) {
      this.logger.warn('Failed to create KPI change notification/email', e?.message || e);
    }

    return saved;
  }

  async listRequests(query: any, authUser: any) {
    const roleRaw = (authUser.role || '').trim();
    const roleLc = roleRaw.toLowerCase();
    const role = (roleLc === 'admin' ? 'Admin' : roleLc === 'manager' ? 'Manager' : roleLc === 'employee' ? 'Employee' : roleRaw) as Role;
    const u = await this.users.findByEmail(authUser.email);
    if (!u) throw new BadRequestException('User not found');

    const scope = (query.scope || '').toLowerCase(); // 'mine' | 'inbox' | 'history'
    const status = (query.status || '').trim(); // Pending | Approved | Rejected
    const kra_id = query.kra_id ? Number(query.kra_id) : undefined;

    const qb = this.reqRepo.createQueryBuilder('r');

    if (role === 'Admin') {
      // Admin sees only requests addressed to them
      qb.where('r.approver_role = :arole', { arole: 'Admin' }).andWhere('(r.approver_name = :me)', { me: u.name });
    } else if (role === 'Manager') {
      // Manager: inbox = approver_role Manager and approver_name matches me OR dept matches
      if (scope === 'mine') qb.where('r.requester_name = :me', { me: u.name });
      else qb.where('r.approver_role = :ar', { ar: 'Manager' }).andWhere('(r.approver_name = :me OR r.dept = :dept)', { me: u.name, dept: u.dept });
    } else if (role === 'Employee') {
      qb.where('r.requester_name = :me', { me: u.name });
    } else {
      throw new ForbiddenException('Role not supported');
    }

    if (status) qb.andWhere('r.status = :st', { st: status });
    if (kra_id) qb.andWhere('r.kra_id = :kid', { kid: kra_id });
    qb.orderBy('r.created_at', 'DESC');
    return qb.getMany();
  }

  async getRequest(id: number, authUser: any) {
    const r = await this.reqRepo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Request not found');
    // Rely on controller guard/role visibility or add minimal checks
    return r;
  }

  async decide(id: number, decision: 'approve' | 'reject', comment: string | null, authUser: any) {
    const r = await this.reqRepo.findOne({ where: { id } });
    if (!r) throw new NotFoundException('Request not found');
    const roleRaw = (authUser.role || '').trim();
    const roleLc = roleRaw.toLowerCase();
    const role = (roleLc === 'admin' ? 'Admin' : roleLc === 'manager' ? 'Manager' : roleLc === 'employee' ? 'Employee' : roleRaw) as Role;
    const u = await this.users.findByEmail(authUser.email);
    if (!u) throw new BadRequestException('User not found');
    if (r.approver_role !== role) throw new ForbiddenException('Not allowed to decide this request');
    if (r.approver_name && r.approver_name !== u.name) throw new ForbiddenException('Not allowed to decide this request');

    if (decision === 'reject') {
      r.status = 'Rejected';
      r.decision_comment = comment || null;
      r.decided_by = u.name;
      r.decided_at = new Date();
      await this.reqRepo.save(r);
      await this.notify.createNotification({
        type: 'kpi_change_decision',
        title: `Request #${r.id} rejected`,
        message: comment || null,
        targetRole: r.requester_role,
        targetName: r.requester_name,
        meta: { requestId: r.id, decision: 'Rejected' },
      });
      return { ok: true, status: r.status };
    }

    // Approve
    const kpi = await this.kpiRepo.findOne({ where: { id: r.kpi_id } });
    if (!kpi) throw new BadRequestException('KPI not found');
    const kra = await this.kraRepo.findOne({ where: { kra_id: kpi.kra_id } });
    if (!kra) throw new BadRequestException('KRA not found');

    const requested = JSON.parse(r.requested_changes || '{}');
    const action: 'edit' | 'delete' = (r as any).action === 'delete' ? 'delete' : 'edit';
    this.validateChanges(requested, action);

    if (action === 'delete') {
      await this.kpiRepo.delete({ id: kpi.id });
      r.status = 'Approved';
      r.decision_comment = comment || null;
      r.decided_by = u.name;
      r.decided_at = new Date();
      await this.reqRepo.save(r);
      await this.notify.createNotification({
        type: 'kpi_change_decision',
        title: `Request #${r.id} approved (KPI deleted)`,
        message: null,
        targetRole: r.requester_role,
        targetName: r.requester_name,
        meta: { requestId: r.id, decision: 'Approved', action: 'delete' },
      });
      return { ok: true, status: r.status };
    }

    const changes: Record<string, { from: any; to: any }> = {};
    
    // Only apply the fields that were actually changed in the request
    const apply = (key: keyof Kpi, toVal: any) => {
      // Skip if the field wasn't included in the requested changes
      if (!(key in requested)) return;
      
      const fromVal: any = (kpi as any)[key];
      // Only update if the value is different
      if (fromVal !== toVal) {
        changes[String(key)] = { from: fromVal ?? null, to: toVal };
        (kpi as any)[key] = toVal;
      }
    };

    // Apply only the fields that were included in the request
    if (requested.name !== undefined) apply('name', requested.name);
    if (requested.def !== undefined) apply('def', requested.def);
    if (requested.due_date !== undefined) apply('due_date', requested.due_date);
    if (requested.scoring_method !== undefined) apply('scoring_method', requested.scoring_method);
    if (requested.target !== undefined) apply('target', requested.target);

    // Refresh status based on possibly updated due_date
    try {
      const due = new Date(String(kpi.due_date));
      const today = new Date(new Date().toDateString());
      kpi.kpi_status = (due < today) ? 'End' : 'Active';
    } catch (_) {}

    const updated = await this.kpiRepo.save(kpi);

    // log entry (version increments)
    const last = await this.kpiLogRepo.createQueryBuilder('log')
      .where('log.kpi_id = :id', { id: kpi.id })
      .orderBy('log.version', 'DESC')
      .limit(1)
      .getOne();
    const nextVersion = (last?.version ?? 0) + 1;

    const logRec = this.kpiLogRepo.create({
      kpi_id: kpi.id,
      version: nextVersion,
      kpi_name: updated.name,
      kra_name: kra.name,
      kra_id: kra.kra_id,
      target: updated.target ?? null,
      score: updated.score ?? null,
      comments: updated.comments ?? null,
      created_by: updated.created_by || r.requester_name || null,
      kra_creator_name: kra.created_by || null,
      dept: kra.dept || null,
      updated_by: u.name, // approver as updater
      due_date: updated.due_date as any,
      changes: JSON.stringify(changes),
    } as any);
    await this.kpiLogRepo.save(logRec);

    r.status = 'Approved';
    r.decision_comment = comment || null;
    r.decided_by = u.name;
    r.decided_at = new Date();
    await this.reqRepo.save(r);

    await this.notify.createNotification({
      type: 'kpi_change_decision',
      title: `Request #${r.id} approved`,
      message: null,
      targetRole: r.requester_role,
      targetName: r.requester_name,
      meta: { requestId: r.id, decision: 'Approved' },
    });

    return { ok: true, status: r.status };
  }
}
