import { Controller, Get, UseGuards, Request, Param, Post, Body, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
// Note: Avoid strict typing of UploadedFile to prevent namespace issues in environments without Express types

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @UseGuards(JwtAuthGuard)
  @Get('company/stats')
  async getCompanyStats(@Request() req) {
    // Mock data for now
    return {
      totalUsers: 100,
      activeKPIs: 50,
      departments: 5
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('roles')
  async getRoles(@Request() req) {
    return this.usersService.getRoles();
  }

  @UseGuards(JwtAuthGuard)
  @Get('departments')
  async getDepartments(@Request() req) {
    return this.usersService.getDepartments();
  }

  @UseGuards(JwtAuthGuard)
  @Get('managers')
  async getManagers(@Request() req) {
    return this.usersService.getManagers();
  }

  @UseGuards(JwtAuthGuard)
  @Get('admins')
  async getAdmins(@Request() req) {
    return this.usersService.getAdmins();
  }

  @UseGuards(JwtAuthGuard)
  @Get('department/:dept/managers')
  async getManagersByDepartment(@Param('dept') dept: string, @Request() req) {
    return this.usersService.getManagersByDepartment(dept);
  }

  @UseGuards(JwtAuthGuard)
  @Get('department/:dept/employees')
  async getEmployeesByDepartment(@Param('dept') dept: string) {
    return this.usersService.getEmployeesByDepartment(dept);
  }

  @UseGuards(JwtAuthGuard)
  @Get('managers/performance')
  async getManagerPerformance(@Request() req) {
    // Mock data
    return [
      { id: 1, name: 'John Doe', performance: 85 },
      { id: 2, name: 'Jane Smith', performance: 92 }
    ];
  }

  @UseGuards(JwtAuthGuard)
  @Get('kpis/manager')
  async getManagerKPIs(@Request() req) {
    // Mock data
    return [
      { id: 1, name: 'Team Efficiency', progress: 80 },
      { id: 2, name: 'Project Completion', progress: 75 }
    ];
  }

  @UseGuards(JwtAuthGuard)
  @Get('kpis/employee')
  async getEmployeeKPIs(@Request() req) {
    // Mock data
    return [
      { id: 1, name: 'Individual Goals', progress: 70 },
      { id: 2, name: 'Skill Development', progress: 65 }
    ];
  }

  @UseGuards(JwtAuthGuard)
  @Post('avatar/select')
  async selectDefaultAvatar(@Request() req, @Body() body: any) {
    const userId = req.user?.userId || req.user?.user_id || req.user?.id;
    if (!userId) throw new BadRequestException('Missing user');
    const key = (body?.key || '').toString();
    const allowed = new Set(['male1','male2','male3','male4','male5','female1','female2','female3','female4','female5']);
    if (!allowed.has(key)) throw new BadRequestException('Invalid avatar key');
    const value = `default:${key}`;
    await this.usersService.updateAvatarByUserId(Number(userId), value);
    return { success: true, avatar: value };
  }

  @UseGuards(JwtAuthGuard)
  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const dest = path.join(process.cwd(), 'backend', 'uploads', 'avatars');
        fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
      },
      filename: (req, file, cb) => {
        const userId = req.user?.userId || req.user?.user_id || req.user?.id;
        const email = (req.user?.email || '').toString();
        const name = (req.user?.name || '').toString();
        const baseRaw = email || name || (userId ? `u_${userId}` : 'u_unknown');
        const base = baseRaw.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
        const ext = path.extname(file.originalname || '').toLowerCase() || '.png';
        cb(null, `${base}${ext}`);
      }
    }),
    fileFilter: (req, file, cb) => {
      const ok = /\.(png|jpg|jpeg|gif|webp)$/i.test(file.originalname || '');
      cb(ok ? null : new BadRequestException('Only image files (PNG, JPG, JPEG, GIF, WEBP) are allowed'), ok);
    },
    limits: { 
      fileSize: 10 * 1024 * 1024, // 10MB limit
      files: 1
    }
  }))
  async uploadAvatar(@Request() req, @UploadedFile() file: any) {
    const userId = req.user?.userId || req.user?.user_id || req.user?.id;
    if (!userId) throw new BadRequestException('Missing user');
    if (!file) throw new BadRequestException('File is required');
    const url = `http://localhost:${process.env.PORT ?? 3000}/uploads/avatars/${file.filename}`;
    await this.usersService.updateAvatarByUserId(Number(userId), url);
    return { success: true, avatar: url };
  }
}