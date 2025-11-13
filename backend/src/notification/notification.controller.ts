import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { NotificationService } from './notification.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notification')
export class NotificationController {
  constructor(private readonly svc: NotificationService) {}

  @Post('test')
  @Roles('Employee','Manager','Admin')
  async test(@Body() body: any) {
    const text = body?.text || 'Test notification';
    const r = await this.svc.sendSlack(text);
    return { success: r.ok };
  }

  @Post('submit')
  @Roles('Employee','Manager','Admin')
  async submit(@Body() body: any) {
    const { actorRole, actorName, targetRole, targetName, context } = body || {};
    const parts = [
      actorRole ? `[${actorRole}]` : '',
      actorName || 'Someone',
      'submitted a',
      context?.kra ? `(KRA: ${context.kra})` : '',
      context?.dept ? `(Dept: ${context.dept})` : '',
    ].filter(Boolean);
    const text = parts.join(' ');
    const r = await this.svc.sendSlack(text || 'Submission notification');
    // Persist notification for target
    await this.svc.createNotification({
      type: 'submit',
      title: 'Submission',
      message: text,
      targetRole: String(targetRole || ''),
      targetName: targetName || null,
      meta: { kra: context?.kra || null, dept: context?.dept || null, actorRole, actorName },
    });
    return { success: r.ok };
  }

  @Get('feed')
  @Roles('Employee','Manager','Admin')
  async feed(@Query('role') role: string, @Query('name') name?: string, @Query('limit') limit?: string) {
    const lim = Math.max(1, Math.min(Number(limit) || 20, 100));
    const list = await this.svc.getFeed(String(role || ''), name || undefined, lim);
    return { success: true, data: list };
  }

  @Delete(':id')
  @Roles('Employee','Manager','Admin')
  async deleteOne(@Param('id') id: string, @Query('role') role: string, @Query('name') name?: string) {
    const nid = Number(id);
    const res = await this.svc.deleteForTarget(nid, String(role || ''), name || undefined);
    return { success: res.affected > 0 };
  }
}
