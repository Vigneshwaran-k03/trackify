import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Kpi } from '../kpi/kpi.entity';
import { Kra } from '../kra/kra.entity';
import { MaintenanceService } from './maintenance.service';
import { ScoringModule } from '../scoring/scoring.module';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Kpi, Kra]),
    ScoringModule,
    UsersModule,
    MailModule,
  ],
  providers: [MaintenanceService],
})
export class MaintenanceModule {}
