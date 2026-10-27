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

  async create(createVehicleDto: CreateVehicleDto): Promise<VehicleEntity> {
    const existing = await this.vehicleRepository.findOne({
      where: { plate: createVehicleDto.plate },
      withDeleted: true,
    });

    if (existing) {
      throw new ConflictException(
        'La placa ya está registrada en el sistema',
      );
    }

    const vehicle = this.vehicleRepository.create({
      plate: createVehicleDto.plate,
      brand: createVehicleDto.brand,
      model: createVehicleDto.model,
      year: createVehicleDto.year,
      mileage: createVehicleDto.mileage,
      status: createVehicleDto.status ?? VehicleStatus.AVAILABLE,
    });

    return this.vehicleRepository.save(vehicle);
  }

  async findAll(): Promise<VehicleEntity[]> {
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

  async update(
    id: number,
    updateVehicleDto: UpdateVehicleDto,
  ): Promise<VehicleEntity> {
    const vehicle = await this.findOneById(id);

    if (updateVehicleDto.plate && updateVehicleDto.plate !== vehicle.plate) {
      const existingPlate = await this.vehicleRepository.findOne({
        where: { plate: updateVehicleDto.plate },
        withDeleted: true,
      });
      if (existingPlate) {
        throw new ConflictException(
          'La placa ya está registrada en el sistema',
        );
      }
    }

    Object.assign(vehicle, updateVehicleDto);
    return this.vehicleRepository.save(vehicle);
  }

  async softDelete(id: number): Promise<VehicleEntity> {
    const vehicle = await this.findOneById(id);
    return this.vehicleRepository.softRemove(vehicle);
  }
}
