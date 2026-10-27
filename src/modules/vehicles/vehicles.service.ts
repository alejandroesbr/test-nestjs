import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateVehicleDto } from './dto/create-vehicle.dto.js';
import { UpdateVehicleDto } from './dto/update-vehicle.dto.js';
import { VehicleEntity, VehicleStatus } from './entities/vehicle.entity.js';

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(VehicleEntity)
    private readonly vehicleRepository: Repository<VehicleEntity>,
  ) {}

  async create(dto: CreateVehicleDto): Promise<VehicleEntity> {
    await this.ensureUniquePlate(dto.plate);
    return this.vehicleRepository.save(
      this.vehicleRepository.create({
        plate: dto.plate,
        brand: dto.brand,
        model: dto.model,
        year: dto.year,
        mileage: dto.mileage,
        status: dto.status ?? VehicleStatus.AVAILABLE,
      }),
    );
  }

  findAll(): Promise<VehicleEntity[]> {
    return this.vehicleRepository.find();
  }

  async findOneById(id: number): Promise<VehicleEntity> {
    const vehicle = await this.vehicleRepository.findOneBy({ id });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle with ID ${id} not found`);
    }
    return vehicle;
  }

  async findByPlate(plate: string): Promise<VehicleEntity> {
    const vehicle = await this.vehicleRepository.findOneBy({ plate });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle with plate ${plate} not found`);
    }
    return vehicle;
  }

  async update(id: number, dto: UpdateVehicleDto): Promise<VehicleEntity> {
    const vehicle = await this.findOneById(id);
    if (dto.plate && dto.plate !== vehicle.plate) {
      await this.ensureUniquePlate(dto.plate);
    }
    Object.assign(vehicle, dto);
    return this.vehicleRepository.save(vehicle);
  }

  async softDelete(id: number): Promise<VehicleEntity> {
    const vehicle = await this.findOneById(id);
    return this.vehicleRepository.softRemove(vehicle);
  }

  private async ensureUniquePlate(plate: string): Promise<void> {
    const existing = await this.vehicleRepository.findOne({
      where: { plate },
      withDeleted: true,
    });
    if (existing) {
      throw new ConflictException('La placa ya está registrada en el sistema');
    }
  }
}
