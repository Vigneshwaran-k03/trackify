import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { RoleService } from './role.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('roles')
export class RoleController {
  constructor(private readonly roleService: RoleService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  async createRole(@Body() body: { role_name: string }) {
    return this.roleService.createRole(body.role_name);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async getAllRoles() {
    return this.roleService.findAllRoles();
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getRoleById(@Param('id') id: string) {
    return this.roleService.findRoleById(parseInt(id));
  }
}
