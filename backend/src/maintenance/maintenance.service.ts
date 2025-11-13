import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Kpi } from '../kpi/kpi.entity';
import { Kra } from '../kra/kra.entity';
import { ScoringService } from '../scoring/scoring.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';

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
}
