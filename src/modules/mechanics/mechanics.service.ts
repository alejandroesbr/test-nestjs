import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateMechanicDto } from './dto/create-mechanic.dto.js';
import { UpdateMechanicDto } from './dto/update-mechanic.dto.js';
import { MechanicEntity } from './entities/mechanic.entity.js';

@Injectable()
export class MechanicsService {
  constructor(
    @InjectRepository(MechanicEntity)
    private readonly mechanicRepository: Repository<MechanicEntity>,
  ) {}

  async create(createMechanicDto: CreateMechanicDto): Promise<MechanicEntity> {
    const existing = await this.mechanicRepository.findOneBy({
      email: createMechanicDto.email,
    });

    if (existing) {
      throw new ConflictException('Mechanic email is already registered');
    }

    const mechanic = this.mechanicRepository.create({
      name: createMechanicDto.name,
      email: createMechanicDto.email,
      specialty: createMechanicDto.specialty,
      status: createMechanicDto.status ?? true,
      userId: createMechanicDto.userId ?? null,
    });

    return this.mechanicRepository.save(mechanic);
  }

  async findAll(): Promise<MechanicEntity[]> {
    return this.mechanicRepository.find();
  }

  async findOne(id: number): Promise<MechanicEntity> {
    const mechanic = await this.mechanicRepository.findOneBy({ id });
    if (!mechanic) {
      throw new NotFoundException(`Mechanic with ID ${id} not found`);
    }
    return mechanic;
  }

  async update(
    id: number,
    updateMechanicDto: UpdateMechanicDto,
  ): Promise<MechanicEntity> {
    const mechanic = await this.findOne(id);

    if (updateMechanicDto.email && updateMechanicDto.email !== mechanic.email) {
      const existingEmail = await this.mechanicRepository.findOneBy({
        email: updateMechanicDto.email,
      });
      if (existingEmail) {
        throw new ConflictException('Mechanic email is already registered');
      }
    }

    Object.assign(mechanic, updateMechanicDto);
    return this.mechanicRepository.save(mechanic);
  }

  async changeStatus(id: number, status?: boolean): Promise<MechanicEntity> {
    const mechanic = await this.findOne(id);
    mechanic.status = status !== undefined ? status : !mechanic.status;
    return this.mechanicRepository.save(mechanic);
  }
}
