import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from './dept.entity';
import { DeptService } from './dept.service';
import { DeptController } from './dept.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Department])],
  providers: [DeptService],
  controllers: [DeptController],
  exports: [DeptService],
})
export class DeptModule {}
