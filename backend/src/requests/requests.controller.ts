import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { RequestsService } from './requests.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RequestsController {
  constructor(private readonly service: RequestsService) {}

  @Post('kpi-change')
  @Roles('Manager', 'Employee')
  async create(@Body() body: { kpi_id: number; requested_changes: Record<string, any>; request_comment?: string | null }, @Request() req) {
    const data = await this.service.createRequest(body, req.user);
    return { success: true, data };
  }

  // KRA change request creation (Manager only)
  @Post('kra-change')
  @Roles('Manager')
  async createKra(@Body() body: { kra_id: number; requested_changes: Record<string, any>; request_comment?: string | null }, @Request() req) {
    const data = await this.service.createKraRequest(body, req.user);
    return { success: true, data };
  }

  @Get()
  @Roles('Admin', 'Manager', 'Employee')
  async list(
    @Query('scope') scope: string,
    @Query('status') status: string,
    @Query('kra_id') kra_id: string,
    @Request() req,
  ) {
    const data = await this.service.listRequests({ scope, status, kra_id }, req.user);
    return { success: true, data };
  }

  // List KRA requests (Admin inbox or Manager mine)
  @Get('kra')
  @Roles('Admin', 'Manager')
  async listKra(
    @Query('scope') scope: string,
    @Query('status') status: string,
    @Query('kra_id') kra_id: string,
    @Request() req,
  ) {
    const data = await this.service.listKraRequests({ scope, status, kra_id }, req.user);
    return { success: true, data };
  }

  @Get(':id')
  @Roles('Admin', 'Manager', 'Employee')
  async get(@Param('id') id: string, @Request() req) {
    const data = await this.service.getRequest(Number(id), req.user);
    return { success: true, data };
  }

  @Get('kra/:id')
  @Roles('Admin', 'Manager')
  async getKra(@Param('id') id: string, @Request() req) {
    const data = await this.service.getKraRequest(Number(id), req.user);
    return { success: true, data };
  }

  @Post(':id/approve')
  @Roles('Admin', 'Manager')
  async approve(@Param('id') id: string, @Body() body: { comment?: string | null }, @Request() req) {
    const data = await this.service.decide(Number(id), 'approve', body?.comment ?? null, req.user);
    return { success: true, data };
  }

  @Post(':id/reject')
  @Roles('Admin', 'Manager')
  async reject(@Param('id') id: string, @Body() body: { comment?: string | null }, @Request() req) {
    const data = await this.service.decide(Number(id), 'reject', body?.comment ?? null, req.user);
    return { success: true, data };
  }

  // Approve/Reject KRA requests
  @Post('kra/:id/approve')
  @Roles('Admin')
  async approveKra(@Param('id') id: string, @Body() body: { comment?: string | null }, @Request() req) {
    const data = await this.service.decideKra(Number(id), 'approve', body?.comment ?? null, req.user);
    return { success: true, data };
  }

  @Post('kra/:id/reject')
  @Roles('Admin')
  async rejectKra(@Param('id') id: string, @Body() body: { comment?: string | null }, @Request() req) {
    const data = await this.service.decideKra(Number(id), 'reject', body?.comment ?? null, req.user);
    return { success: true, data };
  }
}
