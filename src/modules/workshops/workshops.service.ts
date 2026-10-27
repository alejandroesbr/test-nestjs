import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateWorkshopDto } from './dto/create-workshop.dto.js';
import { WorkshopEntity } from './entities/workshop.entity.js';

@Injectable()
export class WorkshopsService {
  constructor(
    @InjectRepository(WorkshopEntity)
    private readonly workshopRepository: Repository<WorkshopEntity>,
  ) {}

  async create(createWorkshopDto: CreateWorkshopDto): Promise<WorkshopEntity> {
    const workshop = this.workshopRepository.create({
      name: createWorkshopDto.name,
      address: createWorkshopDto.address,
      status: createWorkshopDto.status ?? true,
    });
    return this.workshopRepository.save(workshop);
  }

  async findActive(): Promise<WorkshopEntity[]> {
    return this.workshopRepository.find({
      where: { status: true },
    });
  }

  async findOne(id: number): Promise<WorkshopEntity> {
    const workshop = await this.workshopRepository.findOneBy({ id });
    if (!workshop) {
      throw new NotFoundException(`Workshop with ID ${id} not found`);
    }
    return workshop;
  }

  async deactivate(id: number): Promise<WorkshopEntity> {
    const workshop = await this.findOne(id);
    workshop.status = false;
    return this.workshopRepository.save(workshop);
  }
}
