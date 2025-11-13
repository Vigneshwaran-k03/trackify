import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScoringService } from './scoring.service';
import { ScoringController } from './scoring.controller';
import { Kpi } from '../kpi/kpi.entity';
import { Kra } from '../kra/kra.entity';
import { UsersModule } from '../users/users.module';
import { KpiLog } from '../kpi/kpi-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Kpi, Kra, KpiLog]), UsersModule],
  providers: [ScoringService],
  controllers: [ScoringController],
  exports: [ScoringService],
})
export class ScoringModule {}
