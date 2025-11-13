import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Kpi } from './kpi.entity';
import { KpiService } from './kpi.service';
import { KpiController } from './kpi.controller';
import { Kra } from '../kra/kra.entity';
import { UsersModule } from '../users/users.module';
import { KpiLog } from './kpi-log.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Kpi, Kra, KpiLog]), UsersModule],
  providers: [KpiService],
  controllers: [KpiController],
  exports: [KpiService],
})
export class KpiModule {}
