import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Kpi } from '../kpi/kpi.entity';
import { Kra } from '../kra/kra.entity';
import { ScoringService } from '../scoring/scoring.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import * as puppeteer from 'puppeteer';

@Injectable()
export class MaintenanceService implements OnModuleInit {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    @InjectRepository(Kpi) private readonly kpiRepo: Repository<Kpi>,
    @InjectRepository(Kra) private readonly kraRepo: Repository<Kra>,
    private readonly scoringService: ScoringService,
    private readonly usersService: UsersService,
    private readonly mail: MailService,
  ) {}

  async onModuleInit() {
    // Run once on startup
    await this.runDailyMaintenance('startup');
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async nightly() {
    await this.runDailyMaintenance('cron');
  }

  @Cron('32 17 * * *')
  async weeklyReports() {
    try {
      await this.generateAndSendWeeklyReports();
    } catch (e) {
      this.logger.error(`Weekly reports failed: ${e?.message || e}`);
    }
  }

  private async runDailyMaintenance(source: 'startup'|'cron') {
    try {
      const today = new Date(new Date().toDateString());
      // 1) Auto-end KPIs whose due date has passed
      await this.kpiRepo
        .createQueryBuilder()
        .update(Kpi)
        .set({ kpi_status: 'End' } as any)
        .where('due_date < :today', { today })
        .andWhere('kpi_status != :end', { end: 'End' })
        .execute();

      // 2) Recalculate and persist KRA overall from ACTIVE KPIs only
      const kraIds = (await this.kraRepo.find({ select: ['kra_id'] })).map(k => k.kra_id);
      for (const id of kraIds) {
        try {
          const { percentage } = await this.scoringService.aggregateKraPercentage(id);
          await this.kraRepo.update({ kra_id: id }, { overall_score: percentage });
        } catch (e) {
          this.logger.warn(`Failed to update KRA ${id} overall: ${e?.message || e}`);
        }
      }

      // 3) Send KPI due reminders (-2d, -1d, 0d)
      const inDays = (a: Date, b: Date) => Math.floor((a.getTime() - b.getTime()) / (24*60*60*1000));
      const upcoming = await this.kpiRepo.find();
      const kraMap = new Map<number, Kra>();
      // Preload related KRAs minimal
      const uniqueKraIds = Array.from(new Set(upcoming.map(k => k.kra_id)));
      if (uniqueKraIds.length) {
        const list = await this.kraRepo.findBy({ kra_id: (undefined as any) } as any);
        // Fallback: fetch all and map; TypeORM findBy with IN may differ per version; keep simple
        for (const k of list) kraMap.set(k.kra_id, k);
      }
      for (const kpi of upcoming) {
        try {
          if (!kpi.due_date) continue;
          const due = new Date(new Date(kpi.due_date).toDateString());
          const delta = inDays(due, today);
          if (delta !== 0 && delta !== 1 && delta !== 2) continue; // 0d today, 1d tomorrow, 2d in two days
          const kra = kraMap.get(kpi.kra_id) || await this.kraRepo.findOne({ where: { kra_id: kpi.kra_id } });
          const targetName = kra?.employee_name || kra?.manager_name || kpi.created_by;
          if (!targetName) continue;
          const user = await this.usersService.findByName(targetName);
          const to = user?.email;
          if (!to) continue;
          const subject = delta === 0
            ? `KPI due today: ${kpi.name}`
            : `KPI due in ${delta} day${delta>1?'s':''}: ${kpi.name}`;
          const body = `Hello ${targetName},\n\nThis is a reminder that the KPI "${kpi.name}" under KRA "${kpi.kra_name}" is due on ${due.toLocaleDateString()}.\n\nDefinition: ${kpi.def}\nScoring Method: ${kpi.scoring_method}\nTarget: ${typeof (kpi as any).target === 'number' ? (kpi as any).target + '%' : 'N/A'}\n\nPlease ensure it is completed on time.`;
          await this.mail.sendMail({ to, subject, text: body });
        } catch (e) {
          this.logger.warn(`Failed to send KPI reminder for KPI ${kpi.id}: ${e?.message || e}`);
        }
      }

      this.logger.log(`Maintenance (${source}) completed for ${kraIds.length} KRAs.`);
    } catch (e) {
      this.logger.error(`Maintenance (${source}) failed: ${e?.message || e}`);
    }
  }

  private async generateAndSendWeeklyReports() {
    const admins = await this.usersService.getAdmins();
    const managers = await this.usersService.getManagers();
    if (!admins.length && !managers.length) {
      this.logger.warn('No admins or managers found for weekly reports');
      return;
    }

    const allKras = await this.kraRepo.find();
    if (!allKras.length) {
      this.logger.warn('No KRAs found for weekly reports');
      return;
    }

    const allKpis = await this.kpiRepo.find();

    const managerMap = new Map<string, { name: string; email: string; dept: string | null }>();
    for (const m of managers) {
      const key = (m.name || '').toLowerCase();
      if (!key) continue;
      managerMap.set(key, { name: m.name, email: m.email || '', dept: m.dept || null });
    }

    const employeeSet = new Set<string>();
    const employeeDept = new Map<string, string | null>();
    const kraByEmployee = new Map<string, Kra[]>();
    const kraByManager = new Map<string, Kra[]>();

    for (const k of allKras) {
      const mgrName = String(k.manager_name || '').trim();
      const empName = String(k.employee_name || '').trim();
      if (mgrName) {
        const key = mgrName.toLowerCase();
        if (!kraByManager.has(key)) kraByManager.set(key, []);
        kraByManager.get(key)!.push(k);
      }
      if (empName) {
        const eKey = empName.toLowerCase();
        employeeSet.add(eKey);
        employeeDept.set(eKey, k.dept || null);
        if (!kraByEmployee.has(eKey)) kraByEmployee.set(eKey, []);
        kraByEmployee.get(eKey)!.push(k);
      }
    }

    const employeeAverages = new Map<string, { name: string; dept: string | null; avg: number; count: number }>();
    for (const eKey of employeeSet) {
      const kras = kraByEmployee.get(eKey) || [];
      if (!kras.length) continue;
      const percentages: number[] = [];
      for (const k of kras) {
        try {
          const { percentage } = await this.scoringService.aggregateKraPercentage(k.kra_id);
          if (typeof percentage === 'number' && Number.isFinite(percentage)) {
            percentages.push(percentage);
          }
        } catch {
        }
      }
      const avg = percentages.length ? Math.round((percentages.reduce((a, b) => a + b, 0) / percentages.length) * 100) / 100 : 0;
      const name = Array.from(allKras).find(x => String(x.employee_name || '').trim().toLowerCase() === eKey)?.employee_name || eKey;
      employeeAverages.set(eKey, { name, dept: employeeDept.get(eKey) || null, avg, count: percentages.length });
    }

    const html = this.buildWeeklyHtml(employeeAverages, managerMap, kraByManager, allKras, allKpis);
    const pdfBuffer = await this.renderHtmlToPdf(html);

    for (const admin of admins) {
      if (!admin.email) continue;
      await this.mail.sendMail({
        to: admin.email,
        subject: 'Weekly Performance Summary',
        text: 'Please find attached the weekly performance summary for managers and employees.',
        attachments: [{ filename: 'weekly-summary.pdf', content: pdfBuffer }],
      });
    }

    for (const [key, mgr] of managerMap.entries()) {
      if (!mgr.email) continue;
      const mgrKras = kraByManager.get(key) || [];
      if (!mgrKras.length) continue;

      // Determine employees that truly belong to this manager: from KRAs where this manager is set
      const mgrEmployeeKeys = new Set<string>();
      for (const k of mgrKras) {
        const rawName = String(k.employee_name || '').trim();
        if (!rawName) continue;
        mgrEmployeeKeys.add(rawName.toLowerCase());
      }

      // Optionally narrow further by department if manager has one
      const deptName = mgr.dept || '';
      const deptEmployees = deptName ? await this.usersService.getEmployeesByDepartment(deptName) : [];

      // Build employee summaries: only employees that have KRAs under this manager
      const empMap = new Map<string, { name: string; dept: string | null; avg: number; count: number }>();

      // Seed from dept employees that match manager-owned employees so names come from user records
      for (const e of deptEmployees) {
        const rawName = String(e.name || '').trim();
        if (!rawName) continue;
        const eKey = rawName.toLowerCase();
        if (!mgrEmployeeKeys.has(eKey)) continue; // skip employees not under this manager
        if (!empMap.has(eKey)) {
          empMap.set(eKey, { name: rawName, dept: e.dept || mgr.dept || null, avg: 0, count: 0 });
        }
      }

      // Accumulate KRA performance per employee for this manager (only for manager-owned KRAs)
      for (const k of mgrKras) {
        const rawName = String(k.employee_name || '').trim();
        if (!rawName) continue;
        const eKey = rawName.toLowerCase();
        if (!mgrEmployeeKeys.has(eKey)) continue;
        if (!empMap.has(eKey)) {
          empMap.set(eKey, { name: rawName, dept: k.dept || mgr.dept || null, avg: 0, count: 0 });
        }
        const rec = empMap.get(eKey)!;
        const overall = typeof (k as any).overall_score === 'number' ? (k as any).overall_score as number : 0;
        rec.avg = rec.avg * rec.count + overall;
        rec.count += 1;
        rec.avg = rec.count ? Math.round((rec.avg / rec.count) * 100) / 100 : 0;
      }

      const empRows = Array.from(empMap.values());

      const mgrHtml = this.buildManagerHtml(mgr, empRows, mgrKras, allKpis);
      const mgrPdf = await this.renderHtmlToPdf(mgrHtml);
      await this.mail.sendMail({
        to: mgr.email,
        subject: 'Weekly Employee Summary',
        text: 'Please find attached the weekly performance summary for your employees.',
        attachments: [{ filename: 'weekly-employee-summary.pdf', content: mgrPdf }],
      });
    }
  }

  private buildWeeklyHtml(
    employeeAverages: Map<string, { name: string; dept: string | null; avg: number; count: number }>,
    managerMap: Map<string, { name: string; email: string; dept: string | null }>,
    kraByManager: Map<string, Kra[]>,
    allKras: Kra[],
    allKpis: Kpi[],
  ): string {
    const rows: string[] = [];
    rows.push('<h1>Weekly Performance Summary</h1>');

    // High-level manager summary (grouped by manager_name on KRAs)
    rows.push('<h2>Managers - Overview</h2>');
    rows.push('<table border="1" cellpadding="4" cellspacing="0"><thead><tr><th>Manager</th><th>Department</th><th>KRAs</th><th>Active KPIs</th><th>Avg KRA %</th></tr></thead><tbody>');
    for (const [key, mgr] of managerMap.entries()) {
      const mgrKras = (allKras || []).filter(k => String(k.manager_name || '').trim().toLowerCase() === key);
      const mgrKpiList = (allKpis || []).filter(kpi => mgrKras.some(k => k.kra_id === kpi.kra_id));
      const activeKpis = mgrKpiList.filter(kpi => String(kpi.kpi_status || '').toLowerCase() === 'active');
      const kraPercents = mgrKras
        .map(k => (typeof (k as any).overall_score === 'number' ? (k as any).overall_score as number : NaN))
        .filter(v => Number.isFinite(v));
      const mgrAvg = kraPercents.length
        ? Math.round((kraPercents.reduce((a, b) => a + b, 0) / kraPercents.length) * 100) / 100
        : 0;
      rows.push(`<tr><td>${this.escapeHtml(mgr.name)}</td><td>${this.escapeHtml(mgr.dept || '')}</td><td>${mgrKras.length}</td><td>${activeKpis.length}</td><td>${mgrAvg.toFixed(2)}</td></tr>`);
    }
    rows.push('</tbody></table>');

    // High-level employee summary (grouped by employee_name on KRAs)
    rows.push('<h2>Employees - Overview</h2>');
    rows.push('<table border="1" cellpadding="4" cellspacing="0"><thead><tr><th>Employee</th><th>Department</th><th>Average %</th><th>KRAs Count</th></tr></thead><tbody>');
    const sortedEmp = Array.from(employeeAverages.values()).sort((a, b) => (b.avg || 0) - (a.avg || 0));
    for (const e of sortedEmp) {
      rows.push(`<tr><td>${this.escapeHtml(e.name)}</td><td>${this.escapeHtml(e.dept || '')}</td><td>${e.avg.toFixed(2)}</td><td>${e.count}</td></tr>`);
    }
    rows.push('</tbody></table>');

    // Detailed per-manager section
    rows.push('<hr/><h2>Manager Details</h2>');
    for (const [key, mgr] of managerMap.entries()) {
      const mgrKras = (allKras || []).filter(k => String(k.manager_name || '').trim().toLowerCase() === key);
      if (!mgrKras.length) continue;
      rows.push(`<h3>${this.escapeHtml(mgr.name)} (${this.escapeHtml(mgr.dept || '')})</h3>`);

      // Manager KRAs: show only KRA name, department, target, overall, active KPIs
      rows.push('<h4>KRAs</h4>');
      rows.push('<table border="1" cellpadding="4" cellspacing="0"><thead><tr><th>KRA</th><th>Department</th><th>Target</th><th>Overall %</th><th>Active KPIs</th></tr></thead><tbody>');
      for (const k of mgrKras) {
        const kKpis = (allKpis || []).filter(kpi => kpi.kra_id === k.kra_id);
        const activeKpis = kKpis.filter(kpi => String(kpi.kpi_status || '').toLowerCase() === 'active');
        const overall = typeof (k as any).overall_score === 'number' ? (k as any).overall_score as number : 0;
        const target = typeof (k as any).target === 'number' ? (k as any).target as number : 0;
        rows.push(`<tr><td>${this.escapeHtml(k.name || (k as any).kra_name || '')}</td><td>${this.escapeHtml(k.dept || '')}</td><td>${target}</td><td>${overall.toFixed(2)}</td><td>${activeKpis.length}</td></tr>`);
      }
      rows.push('</tbody></table>');

      // Manager KPIs: show KPI id, target, score, due date, KRA name
      rows.push('<h4>Active KPIs</h4>');
      rows.push('<table border="1" cellpadding="4" cellspacing="0"><thead><tr><th>KPI ID</th><th>Target</th><th>Score</th><th>Due Date</th><th>KRA</th></tr></thead><tbody>');
      const mgrKraIds = new Set(mgrKras.map(k => k.kra_id));
      const mgrKpis = (allKpis || []).filter(kpi => mgrKraIds.has(kpi.kra_id));
      const mgrActiveKpis = mgrKpis.filter(kpi => String(kpi.kpi_status || '').toLowerCase() === 'active');
      for (const kpi of mgrActiveKpis) {
        const kra = mgrKras.find(k => k.kra_id === kpi.kra_id);
        const due = kpi.due_date ? new Date(kpi.due_date as any).toLocaleDateString() : '';
        const scoreVal = typeof (kpi as any).score === 'number' ? (kpi as any).score as number : 0;
        const target = typeof (kpi as any).target === 'number' ? (kpi as any).target as number : 0;
        rows.push(`<tr><td>${kpi.id}</td><td>${target}</td><td>${scoreVal}</td><td>${this.escapeHtml(due)}</td><td>${this.escapeHtml(kpi.kra_name || kra?.name || '')}</td></tr>`);
      }
      rows.push('</tbody></table>');
    }

    // Detailed per-employee section
    rows.push('<hr/><h2>Employee Details</h2>');
    for (const [eKey, info] of employeeAverages.entries()) {
      rows.push(`<h3>${this.escapeHtml(info.name)} (${this.escapeHtml(info.dept || '')}) - Avg ${info.avg.toFixed(2)}%</h3>`);
      const empKras = (allKras || []).filter(k => String(k.employee_name || '').trim().toLowerCase() === eKey);

      // Employee KRAs: show only KRA name, department, target, overall, active KPIs
      rows.push('<h4>KRAs</h4>');
      rows.push('<table border="1" cellpadding="4" cellspacing="0"><thead><tr><th>KRA</th><th>Department</th><th>Target</th><th>Overall %</th><th>Active KPIs</th></tr></thead><tbody>');
      for (const k of empKras) {
        const overall = typeof (k as any).overall_score === 'number' ? (k as any).overall_score as number : 0;
        const target = typeof (k as any).target === 'number' ? (k as any).target as number : 0;
        const empKpisForKra = (allKpis || []).filter(kpi => kpi.kra_id === k.kra_id && String(kpi.kpi_status || '').toLowerCase() === 'active');
        rows.push(`<tr><td>${this.escapeHtml(k.name || (k as any).kra_name || '')}</td><td>${this.escapeHtml(k.dept || '')}</td><td>${target}</td><td>${overall.toFixed(2)}</td><td>${empKpisForKra.length}</td></tr>`);
      }
      rows.push('</tbody></table>');

      // Employee KPIs: show KPI id, target, score, due date, KRA name
      rows.push('<h4>Active KPIs</h4>');
      rows.push('<table border="1" cellpadding="4" cellspacing="0"><thead><tr><th>KPI ID</th><th>Target</th><th>Score</th><th>Due Date</th><th>KRA</th></tr></thead><tbody>');
      const empKraIds = new Set(empKras.map(k => k.kra_id));
      const empKpis = (allKpis || []).filter(kpi => empKraIds.has(kpi.kra_id));
      const empActiveKpis = empKpis.filter(kpi => String(kpi.kpi_status || '').toLowerCase() === 'active');
      for (const kpi of empActiveKpis) {
        const kra = empKras.find(k => k.kra_id === kpi.kra_id);
        const due = kpi.due_date ? new Date(kpi.due_date as any).toLocaleDateString() : '';
        const scoreVal = typeof (kpi as any).score === 'number' ? (kpi as any).score as number : 0;
        const target = typeof (kpi as any).target === 'number' ? (kpi as any).target as number : 0;
        rows.push(`<tr><td>${kpi.id}</td><td>${target}</td><td>${scoreVal}</td><td>${this.escapeHtml(due)}</td><td>${this.escapeHtml(kpi.kra_name || kra?.name || '')}</td></tr>`);
      }
      rows.push('</tbody></table>');
    }

    return `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Weekly Summary</title><style>body{font-family:Arial,Helvetica,sans-serif;font-size:12px;}h1,h2,h3,h4{color:#111827;}table{border-collapse:collapse;width:100%;margin-top:8px;}th{background:#111827;color:#ffffff;font-weight:bold;}td,th{border:1px solid #e5e7eb;padding:4px;text-align:left;}hr{margin:16px 0;border:0;border-top:1px solid #e5e7eb;}</style></head><body>${rows.join('')}</body></html>`;
  }

  private buildManagerHtml(
    mgr: { name: string; email: string; dept: string | null },
    employees: { name: string; dept: string | null; avg: number; count: number }[],
    mgrKras: Kra[],
    allKpis: Kpi[],
  ): string {
    const rows: string[] = [];
    rows.push(`<h1>Weekly Employee Summary - ${this.escapeHtml(mgr.name)}</h1>`);
    rows.push(`<p>Department: ${this.escapeHtml(mgr.dept || '')}</p>`);

    // Manager-level summary
    const kraPercents = mgrKras
      .map(k => (typeof (k as any).overall_score === 'number' ? (k as any).overall_score as number : NaN))
      .filter(v => Number.isFinite(v));
    const mgrAvg = kraPercents.length
      ? Math.round((kraPercents.reduce((a, b) => a + b, 0) / kraPercents.length) * 100) / 100
      : 0;
    const mgrKraIds = new Set(mgrKras.map(k => k.kra_id));
    const mgrKpis = (allKpis || []).filter(kpi => mgrKraIds.has(kpi.kra_id));
    const mgrActiveKpis = mgrKpis.filter(kpi => String(kpi.kpi_status || '').toLowerCase() === 'active');
    rows.push(`<p>KRAs: ${mgrKras.length} | Active KPIs: ${mgrActiveKpis.length} | Avg KRA %: ${mgrAvg.toFixed(2)}%</p>`);

    // Employee overview (under this manager)
    rows.push('<h2>Employees - Overview</h2>');
    rows.push('<table border="1" cellpadding="4" cellspacing="0"><thead><tr><th>Employee</th><th>Average %</th><th>KRAs Count</th></tr></thead><tbody>');
    const sortedEmp = employees.slice().sort((a, b) => (b.avg || 0) - (a.avg || 0));
    for (const e of sortedEmp) {
      rows.push(`<tr><td>${this.escapeHtml(e.name)}</td><td>${e.avg.toFixed(2)}</td><td>${e.count}</td></tr>`);
    }
    rows.push('</tbody></table>');

    // Detailed per-employee sections (similar to admin view, but only for this manager)
    if (employees.length) {
      rows.push('<h2>Employee Details</h2>');
      const mgrKraIds = new Set(mgrKras.map(k => k.kra_id));
      const mgrKpis = (allKpis || []).filter(kpi => mgrKraIds.has(kpi.kra_id));
      const mgrActiveKpis = mgrKpis.filter(kpi => String(kpi.kpi_status || '').toLowerCase() === 'active');

      for (const emp of sortedEmp) {
        const eKey = String(emp.name || '').trim().toLowerCase();
        rows.push(`<h3>${this.escapeHtml(emp.name)} (${this.escapeHtml(emp.dept || '')}) - Avg ${emp.avg.toFixed(2)}%</h3>`);

        const empKras = mgrKras.filter(k => String(k.employee_name || '').trim().toLowerCase() === eKey);

        // Employee KRAs under this manager
        rows.push('<h4>KRAs</h4>');
        rows.push('<table border="1" cellpadding="4" cellspacing="0"><thead><tr><th>KRA</th><th>Department</th><th>Target</th><th>Overall %</th><th>Active KPIs</th></tr></thead><tbody>');
        for (const k of empKras) {
          const empKpisForKra = mgrActiveKpis.filter(kpi => kpi.kra_id === k.kra_id);
          const overall = typeof (k as any).overall_score === 'number' ? (k as any).overall_score as number : 0;
          const target = typeof (k as any).target === 'number' ? (k as any).target as number : 0;
          rows.push(`<tr><td>${this.escapeHtml(k.name || (k as any).kra_name || '')}</td><td>${this.escapeHtml(k.dept || '')}</td><td>${target}</td><td>${overall.toFixed(2)}</td><td>${empKpisForKra.length}</td></tr>`);
        }
        rows.push('</tbody></table>');

        // Employee KPIs under this manager
        rows.push('<h4>Active KPIs</h4>');
        rows.push('<table border="1" cellpadding="4" cellspacing="0"><thead><tr><th>KPI ID</th><th>Target</th><th>Score</th><th>Due Date</th><th>KRA</th></tr></thead><tbody>');
        const empKraIds = new Set(empKras.map(k => k.kra_id));
        const empKpis = mgrActiveKpis.filter(kpi => empKraIds.has(kpi.kra_id));
        for (const kpi of empKpis) {
          const kra = empKras.find(k => k.kra_id === kpi.kra_id);
          const due = kpi.due_date ? new Date(kpi.due_date as any).toLocaleDateString() : '';
          const scoreVal = typeof (kpi as any).score === 'number' ? (kpi as any).score as number : 0;
          const target = typeof (kpi as any).target === 'number' ? (kpi as any).target as number : 0;
          rows.push(`<tr><td>${kpi.id}</td><td>${target}</td><td>${scoreVal}</td><td>${this.escapeHtml(due)}</td><td>${this.escapeHtml(kpi.kra_name || kra?.name || '')}</td></tr>`);
        }
        rows.push('</tbody></table>');
      }
    }

    // Summary of all manager KRAs: KRA name, department, target, overall, active KPIs
    rows.push('<h2>KRAs - Summary</h2>');
    rows.push('<table border="1" cellpadding="4" cellspacing="0"><thead><tr><th>KRA</th><th>Department</th><th>Target</th><th>Overall %</th><th>Active KPIs</th></tr></thead><tbody>');
    for (const k of mgrKras) {
      const kKpis = mgrActiveKpis.filter(kpi => kpi.kra_id === k.kra_id);
      const overall = typeof (k as any).overall_score === 'number' ? (k as any).overall_score as number : 0;
      const target = typeof (k as any).target === 'number' ? (k as any).target as number : 0;
      rows.push(`<tr><td>${this.escapeHtml(k.name || (k as any).kra_name || '')}</td><td>${this.escapeHtml(k.dept || '')}</td><td>${target}</td><td>${overall.toFixed(2)}</td><td>${kKpis.length}</td></tr>`);
    }
    rows.push('</tbody></table>');

    // Detailed KPIs: KPI id, target, score, due date, KRA name
    rows.push('<h2>Active KPIs</h2>');
    rows.push('<table border="1" cellpadding="4" cellspacing="0"><thead><tr><th>KPI ID</th><th>Target</th><th>Score</th><th>Due Date</th><th>KRA</th></tr></thead><tbody>');
    for (const kpi of mgrActiveKpis) {
      const kra = mgrKras.find(k => k.kra_id === kpi.kra_id);
      const due = kpi.due_date ? new Date(kpi.due_date as any).toLocaleDateString() : '';
      const scoreVal = typeof (kpi as any).score === 'number' ? (kpi as any).score as number : 0;
      const target = typeof (kpi as any).target === 'number' ? (kpi as any).target as number : 0;
      rows.push(`<tr><td>${kpi.id}</td><td>${target}</td><td>${scoreVal}</td><td>${this.escapeHtml(due)}</td><td>${this.escapeHtml(kpi.kra_name || kra?.name || '')}</td></tr>`);
    }
    rows.push('</tbody></table>');

    return `<!DOCTYPE html><html><head><meta charset="utf-8" /><title>Weekly Employee Summary</title><style>body{font-family:Arial,Helvetica,sans-serif;font-size:12px;}h1,h2{color:#111827;}table{border-collapse:collapse;width:100%;margin-top:8px;}th{background:#111827;color:#ffffff;font-weight:bold;}td,th{border:1px solid #e5e7eb;padding:4px;text-align:left;}</style></head><body>${rows.join('')}</body></html>`;
  }

  private async renderHtmlToPdf(html: string): Promise<Uint8Array> {
    const browser = await puppeteer.launch({ headless: 'new' as any });
    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true });
      return pdf;
    } finally {
      await browser.close();
    }
  }

  private escapeHtml(s: string): string {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c));
  }
}
