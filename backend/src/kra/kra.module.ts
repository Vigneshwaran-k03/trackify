import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KraController } from './kra.controller';
import { KraService } from './kra.service';
import { Kra } from './kra.entity';
import { KraLog } from './kra-log.entity';
import { UsersModule } from '../users/users.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Kra, KraLog]),
    UsersModule,
    NotificationModule,
  ],
  controllers: [KraController],
  providers: [KraService],
  exports: [KraService],
})
export class KraModule {}