import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { DeptService } from './dept.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('departments')
export class DeptController {
  constructor(private readonly deptService: DeptService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createDepartment(@Body() body: { name: string }) {
    return this.deptService.createDepartment(body.name);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getAllDepartments() {
    return this.deptService.findAllDepartments();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getDepartmentById(@Param('id') id: string) {
    return this.deptService.findDepartmentById(parseInt(id));
  }
}
