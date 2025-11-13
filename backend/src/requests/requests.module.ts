import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KpiChangeRequest } from './kpi-change-request.entity';
import { KraChangeRequest } from './kra-change-request.entity';
import { RequestsService } from './requests.service';
import { RequestsController } from './requests.controller';
import { UsersModule } from '../users/users.module';
import { Kpi } from '../kpi/kpi.entity';
import { KpiLog } from '../kpi/kpi-log.entity';
import { Kra } from '../kra/kra.entity';
import { KraLog } from '../kra/kra-log.entity';
import { NotificationModule } from '../notification/notification.module';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([KpiChangeRequest, KraChangeRequest, Kpi, KpiLog, Kra, KraLog]),
    UsersModule,
    NotificationModule,
    MailModule,
  ],
  controllers: [RequestsController],
  providers: [RequestsService],
  exports: [RequestsService],
})
export class RequestsModule {}
