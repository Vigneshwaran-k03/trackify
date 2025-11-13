import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from './dept.entity';

@Injectable()
export class DeptService {
  constructor(
    @InjectRepository(Department)
    private readonly deptRepository: Repository<Department>,
  ) {}

  async createDepartment(name: string): Promise<Department> {
    // Check if department already exists
    const existingDept = await this.deptRepository.findOne({ where: { name } });
    if (existingDept) {
      throw new ConflictException('Department with this name already exists');
    }

    const department = this.deptRepository.create({ name });
    return await this.deptRepository.save(department);
  }

  async findAllDepartments(): Promise<Department[]> {
    return await this.deptRepository.find();
  }

  async findDepartmentById(id: number): Promise<Department> {
    const department = await this.deptRepository.findOne({ where: { id } });
    if (!department) {
      throw new NotFoundException('Department not found');
    }
    return department;
  }

  async findDepartmentByName(name: string): Promise<Department> {
    const department = await this.deptRepository.findOne({ where: { name } });
    if (!department) {
      throw new NotFoundException('Department not found');
    }
    return department;
  }
}
