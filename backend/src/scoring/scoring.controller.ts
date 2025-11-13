import { Controller, Post, Body, UseGuards, Request, Get, Param } from '@nestjs/common';
import { ScoringService } from './scoring.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

interface AddScoreDto {
  kpi_id: number;
  comments?: string;
  score: number;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('scoring')
export class ScoringController {
  constructor(private readonly scoringService: ScoringService) {}

  @Post('add')
  @Roles('Manager', 'Employee')
  async addScore(@Body() dto: AddScoreDto, @Request() req) {
    const data = await this.scoringService.addOrUpdateScore(dto, req.user);
    return { success: true, data };
  }

  @Get('kpi/:kpiId')
  @Roles('Admin', 'Manager', 'Employee')
  async getKpi(@Param('kpiId') kpiId: string) {
    const data = await this.scoringService.getKpiScore(Number(kpiId));
    return { success: true, data };
  }

  @Get('kra/:kraId')
  @Roles('Admin', 'Manager', 'Employee')
  async listByKra(@Param('kraId') kraId: string) {
    const data = await this.scoringService.listKpisWithScoresByKra(Number(kraId));
    return { success: true, data };
  }

  @Get('kra/:kraId/aggregate')
  @Roles('Admin', 'Manager', 'Employee')
  async aggregate(@Param('kraId') kraId: string) {
    const data = await this.scoringService.aggregateKraPercentage(Number(kraId));
    return { success: true, data };
  }
}
