import { Controller, Post, Body, UseGuards, Request, Get, Put, Param, Delete } from '@nestjs/common';
import { KpiService } from './kpi.service';
import type { CreateKpiDto, UpdateKpiDto } from './kpi.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Query } from '@nestjs/common';

@Controller('kpi')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KpiController {
  constructor(private readonly kpiService: KpiService) {}

  @Post('create')
  @Roles('Manager', 'Employee')
  async create(@Body() dto: CreateKpiDto, @Request() req) {
    const data = await this.kpiService.createKpi(dto, req.user);
    return { success: true, data };
  }

  @Get('available')
  @Roles('Admin', 'Manager', 'Employee')
  async getAvailable(@Request() req) {
    const data = await this.kpiService.getAvailableKras(req.user);
    return { success: true, data };
  }

  @Get('my')
  @Roles('Manager', 'Employee')
  async myKpis(@Request() req, @Query('status') status?: string) {
    const data = await this.kpiService.listMyKpis(req.user, status);
    return { success: true, data };
  }

  @Put(':id')
  @Roles('Manager', 'Employee')
  async update(@Param('id') id: string, @Body() dto: UpdateKpiDto, @Request() req) {
    const data = await this.kpiService.updateKpi(Number(id), dto, req.user);
    return { success: true, data };
  }

  @Delete(':id')
  @Roles('Admin')
  async remove(@Param('id') id: string, @Request() req) {
    const data = await this.kpiService.deleteKpi(Number(id), req.user);
    return { success: true, data };
  }

  @Get('department/:dept')
  @Roles('Admin', 'Manager')
  async listByDepartment(@Param('dept') dept: string) {
    const data = await this.kpiService.findByDepartment(dept);
    return { success: true, data };
  }

  @Get('logs')
  @Roles('Admin', 'Manager', 'Employee')
  async getLogs(
    @Query('dept') dept: string,
    @Query('manager') manager: string,
    @Query('employee') employee: string,
    @Request() req,
  ) {
    const data = await this.kpiService.getLogs({ dept, manager, employee }, req.user);
    return { success: true, data };
  }
}
