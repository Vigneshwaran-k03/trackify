import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './role.entity';

@Injectable()
export class RoleService {
  constructor(
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
  ) {}

  async createRole(name: string): Promise<Role> {
    // Check if role already exists
    const existingRole = await this.roleRepository.findOne({ where: { role_name: name } });
    if (existingRole) {
      throw new ConflictException('Role with this name already exists');
    }

    const role = this.roleRepository.create({ role_name: name });
    return await this.roleRepository.save(role);
  }

  async findAllRoles(): Promise<Role[]> {
    return await this.roleRepository.find();
  }

  async findRoleById(id: number): Promise<Role> {
    const role = await this.roleRepository.findOne({ where: { id } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  async findRoleByName(name: string): Promise<Role> {
    const role = await this.roleRepository.findOne({ where: { role_name: name } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }
}
