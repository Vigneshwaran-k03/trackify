import { Body, Controller, Get, Param, Post, Query, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ReviewService } from './review.service';
import type { CreateReviewDto } from './review.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('review')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post()
  @Roles('Manager', 'Admin')
  async create(@Body() dto: CreateReviewDto, @Request() req) {
    const data = await this.reviewService.create(dto, req.user);
    return { success: true, data };
  }

  @Get('employee/:employeeId')
  @Roles('Manager', 'Employee', 'Admin')
  async listByEmployee(@Param('employeeId') employeeId: string) {
    const data = await this.reviewService.listByEmployee(Number(employeeId));
    return { success: true, data };
  }

  @Get('employee/:employeeId/month')
  @Roles('Manager', 'Employee', 'Admin')
  async listByEmployeeMonth(
    @Param('employeeId') employeeId: string,
    @Query('year') year: string,
    @Query('month') month: string,
  ) {
    const data = await this.reviewService.listByEmployeeAndMonth(Number(employeeId), Number(year), Number(month));
    return { success: true, data };
  }

  @Get('kra/:kraId')
  @Roles('Manager', 'Admin')
  async listByKra(@Param('kraId') kraId: string, @Query('employeeId') employeeId?: string) {
    const data = await this.reviewService.listByKra(Number(kraId), employeeId ? Number(employeeId) : undefined);
    return { success: true, data };
  }

  @Get('my')
  @Roles('Manager', 'Admin')
  async listMy(@Request() req) {
    const me = String(req.user?.username || req.user?.name || req.user?.email || '');
    const data = await this.reviewService.listByCreator(me.toLowerCase());
    return { success: true, data };
  }

  @Post(':id')
  @Roles('Manager', 'Admin')
  async update(@Param('id') id: string, @Body() body: any, @Request() req) {
    const { score, comment, review_at } = body || {};
    const data = await this.reviewService.updateReview(Number(id), { score, comment, review_at }, req.user);
    return { success: true, data };
  }
}
