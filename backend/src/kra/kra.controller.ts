import { Controller, Post, Body, UseGuards, Request, Get, Param, BadRequestException, Query, Delete } from '@nestjs/common';
import { KraService } from './kra.service';
import type { CreateKraDto } from './kra.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('kra')
@UseGuards(JwtAuthGuard, RolesGuard)
export class KraController {
  constructor(private readonly kraService: KraService) {}

  @Post('create')
  @Roles('Admin', 'Manager')
  async createKra(@Body() createKraDto: CreateKraDto, @Request() req) {
    const kra = await this.kraService.createKra(createKraDto, req.user);
    return {
      success: true,
      message: 'KRA created successfully',
      data: kra,
    };
  }

  @Get('logs')
  @Roles('Admin', 'Manager')
  async getKraLogs(
    @Query('dept') dept: string,
    @Query('manager') manager: string,
    @Query('employee') employee: string,
    @Query('kra_id') kra_id: string,
    @Request() req,
  ) {
    const data = await this.kraService.getLogs(req.user, { dept, manager, employee, kra_id });
    return { success: true, data };
  }

  @Post(':id/update')
  @Roles('Admin')
  async updateByAdmin(
    @Param('id') id: string,
    @Body() body: { name?: string; definition?: string; target?: number | null; manager_name?: string | null; employee_name?: string | null },
    @Request() req,
  ) {
    const data = await this.kraService.updateByAdmin(Number(id), body || {}, req.user);
    return { success: true, data };
  }

  @Post(':id/assign')
  @Roles('Admin')
  async updateAssignment(
    @Param('id') id: string,
    @Body() body: { manager_name?: string | null; employee_name?: string | null },
    @Request() req,
  ) {
    const data = await this.kraService.updateAssignmentByAdmin(Number(id), {
      manager_name: body?.manager_name ?? undefined,
      employee_name: body?.employee_name ?? undefined,
    }, req.user);
    return { success: true, data };
  }

  @Get()
  @Roles('Admin', 'Manager')
  async getAllKras(@Request() req) {
    const kras = await this.kraService.findAll();

    // Filter results based on user role
    if (req.user.role === 'Manager') {
      // Managers should only see KRAs from their department
      const userDetails = await this.kraService['usersService'].findByEmail(req.user.email);
      if (!userDetails) {
        throw new BadRequestException('User not found');
      }
      const filteredKras = kras.filter(kra => kra.dept === userDetails.dept);
      return {
        success: true,
        data: filteredKras,
      };
    }

    return {
      success: true,
      data: kras,
    };
  }

  @Get('department/:dept')
  @Roles('Admin', 'Manager')
  async getKrasByDepartment(@Param('dept') dept: string) {
    const kras = await this.kraService.findByDepartment(dept);
    return {
      success: true,
      data: kras,
    };
  }

  @Get(':id')
  @Roles('Admin', 'Manager')
  async getKraById(@Param('id') id: string, @Request() req) {
    const kra = await this.kraService.findById(parseInt(id));

    if (!kra) {
      return {
        success: false,
        message: 'KRA not found',
      };
    }

    // Check if manager can access this KRA (only their department)
    if (req.user.role === 'Manager') {
      const userDetails = await this.kraService['usersService'].findByEmail(req.user.email);
      if (!userDetails) {
        throw new BadRequestException('User not found');
      }
      if (kra.dept !== userDetails.dept) {
        return {
          success: false,
          message: 'Access denied',
        };
      }
    }

    return {
      success: true,
      data: kra,
    };
  }

  @Delete(':id')
  @Roles('Admin')
  async deleteKraByAdmin(@Param('id') id: string, @Request() req) {
    await this.kraService.deleteByAdmin(parseInt(id), req.user);
    return { success: true };
  }
}