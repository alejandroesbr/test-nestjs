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

  async create(dto: CreateMechanicDto): Promise<MechanicEntity> {
    await this.ensureUniqueEmail(dto.email);
    return this.mechanicRepository.save(
      this.mechanicRepository.create({
        name: dto.name,
        email: dto.email,
        specialty: dto.specialty,
        status: dto.status ?? true,
        userId: dto.userId ?? null,
      }),
    );
  }

  findAll(): Promise<MechanicEntity[]> {
    return this.mechanicRepository.find();
  }

  async findOne(id: number): Promise<MechanicEntity> {
    const mechanic = await this.mechanicRepository.findOneBy({ id });
    if (!mechanic) {
      throw new NotFoundException(`Mechanic with ID ${id} not found`);
    }
    return mechanic;
  }

  async update(id: number, dto: UpdateMechanicDto): Promise<MechanicEntity> {
    const mechanic = await this.findOne(id);
    if (dto.email && dto.email !== mechanic.email) {
      await this.ensureUniqueEmail(dto.email);
    }
    Object.assign(mechanic, dto);
    return this.mechanicRepository.save(mechanic);
  }

  async changeStatus(id: number, status?: boolean): Promise<MechanicEntity> {
    const mechanic = await this.findOne(id);
    mechanic.status = status !== undefined ? status : !mechanic.status;
    return this.mechanicRepository.save(mechanic);
  }

  private async ensureUniqueEmail(email: string): Promise<void> {
    const existing = await this.mechanicRepository.findOneBy({ email });
    if (existing) {
      throw new ConflictException('Mechanic email is already registered');
    }
  }
}
