import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RoleModule } from './role/role.module';
import { DeptModule } from './dept/dept.module';
import { KraModule } from './kra/kra.module';
import { KpiModule } from './kpi/kpi.module';
import { ScoringModule } from './scoring/scoring.module';
import { ReviewModule } from './review/review.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { NotificationModule } from './notification/notification.module';
import { MailModule } from './mail/mail.module';
import { RequestsModule } from './requests/requests.module';
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST'),
        port: parseInt(config.get<string>('DB_PORT') ?? '3306', 10),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASS'),
        database: config.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: true,
        dropSchema: false,
      }),
    }),
    AuthModule,
    UsersModule,
    RoleModule,
    DeptModule,
    KraModule,
    KpiModule,
    ScoringModule,
    ReviewModule,
    MaintenanceModule,
    NotificationModule,
    MailModule,
    RequestsModule,
  ],

})

export class AppModule {}
