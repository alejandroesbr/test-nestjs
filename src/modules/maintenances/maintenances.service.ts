import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  VehicleEntity,
  VehicleStatus,
} from '../vehicles/entities/vehicle.entity.js';
import { MechanicEntity } from '../mechanics/entities/mechanic.entity.js';
import { WorkshopEntity } from '../workshops/entities/workshop.entity.js';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto.js';
import { UpdateMaintenanceStatusDto } from './dto/update-maintenance-status.dto.js';
import {
  MaintenanceEntity,
  MaintenanceStatus,
} from './entities/maintenance.entity.js';

@Injectable()
export class MaintenancesService {
  constructor(
    @InjectRepository(MaintenanceEntity)
    private readonly maintenanceRepository: Repository<MaintenanceEntity>,
    @InjectRepository(VehicleEntity)
    private readonly vehicleRepository: Repository<VehicleEntity>,
    @InjectRepository(MechanicEntity)
    private readonly mechanicRepository: Repository<MechanicEntity>,
    @InjectRepository(WorkshopEntity)
    private readonly workshopRepository: Repository<WorkshopEntity>,
  ) {}

  async create(
    createMaintenanceDto: CreateMaintenanceDto,
  ): Promise<MaintenanceEntity> {
    const vehicle = await this.vehicleRepository.findOneBy({
      id: createMaintenanceDto.vehicleId,
    });
    if (!vehicle) {
      throw new NotFoundException(
        `Vehicle with ID ${createMaintenanceDto.vehicleId} not found`,
      );
    }

    if (vehicle.status !== VehicleStatus.AVAILABLE) {
      throw new ConflictException(
        'El vehículo no está disponible para mantenimiento',
      );
    }

    const mechanic = await this.mechanicRepository.findOneBy({
      id: createMaintenanceDto.mechanicId,
    });
    if (!mechanic || !mechanic.status) {
      throw new ConflictException(
        'El mecánico no existe o no se encuentra activo',
      );
    }

    const workshop = await this.workshopRepository.findOneBy({
      id: createMaintenanceDto.workshopId,
    });
    if (!workshop || !workshop.status) {
      throw new ConflictException(
        'El taller no existe o no se encuentra activo',
      );
    }

    if (createMaintenanceDto.mileage < vehicle.mileage) {
      throw new BadRequestException(
        'El kilometraje registrado no puede ser inferior al actual del vehículo',
      );
    }

    const scheduledDate = new Date(createMaintenanceDto.scheduledDate);

    const overlappingMaintenance = await this.maintenanceRepository.findOne({
      where: {
        mechanicId: createMaintenanceDto.mechanicId,
        scheduledDate,
        status: In([
          MaintenanceStatus.SCHEDULED,
          MaintenanceStatus.IN_PROGRESS,
        ]),
      },
    });

    if (overlappingMaintenance) {
      throw new ConflictException(
        'El mecánico ya tiene un mantenimiento asignado en este horario',
      );
    }

    const maintenance = this.maintenanceRepository.create({
      vehicleId: createMaintenanceDto.vehicleId,
      mechanicId: createMaintenanceDto.mechanicId,
      workshopId: createMaintenanceDto.workshopId,
      type: createMaintenanceDto.type,
      description: createMaintenanceDto.description,
      mileage: createMaintenanceDto.mileage,
      scheduledDate,
      status: MaintenanceStatus.SCHEDULED,
    });

    return this.maintenanceRepository.save(maintenance);
  }

  async updateStatus(
    id: number,
    updateStatusDto: UpdateMaintenanceStatusDto,
  ): Promise<MaintenanceEntity> {
    const maintenance = await this.maintenanceRepository.findOne({
      where: { id },
      relations: {
        vehicle: true,
        mechanic: true,
        workshop: true,
      },
    });

    if (!maintenance) {
      throw new NotFoundException(`Maintenance with ID ${id} not found`);
    }

    if (
      maintenance.status === MaintenanceStatus.COMPLETED ||
      maintenance.status === MaintenanceStatus.CANCELLED
    ) {
      throw new ConflictException(
        'Una orden finalizada o cancelada no puede ser modificada',
      );
    }

    const targetStatus = updateStatusDto.status;

    if (targetStatus === MaintenanceStatus.IN_PROGRESS) {
      if (maintenance.status !== MaintenanceStatus.SCHEDULED) {
        throw new ConflictException(
          'Solo una orden en estado SCHEDULED puede pasar a IN_PROGRESS',
        );
      }

      maintenance.status = MaintenanceStatus.IN_PROGRESS;
      if (maintenance.vehicle) {
        maintenance.vehicle.status = VehicleStatus.IN_MAINTENANCE;
        await this.vehicleRepository.save(maintenance.vehicle);
      }
      return this.maintenanceRepository.save(maintenance);
    }

    if (targetStatus === MaintenanceStatus.CANCELLED) {
      if (maintenance.status !== MaintenanceStatus.SCHEDULED) {
        throw new ConflictException(
          'Solo una orden en estado SCHEDULED puede ser cancelada',
        );
      }

      maintenance.status = MaintenanceStatus.CANCELLED;
      return this.maintenanceRepository.save(maintenance);
    }

    if (targetStatus === MaintenanceStatus.COMPLETED) {
      if (maintenance.status !== MaintenanceStatus.IN_PROGRESS) {
        throw new ConflictException(
          'Solo una orden en estado IN_PROGRESS puede ser completada',
        );
      }

      if (
        !updateStatusDto.workDone ||
        updateStatusDto.finalCost === undefined ||
        !updateStatusDto.finishedAt ||
        updateStatusDto.finalMileage === undefined
      ) {
        throw new BadRequestException(
          'Debe registrar todos los datos de finalización',
        );
      }

      const currentVehicleMileage =
        maintenance.vehicle?.mileage ?? maintenance.mileage;

      if (updateStatusDto.finalMileage < currentVehicleMileage) {
        throw new BadRequestException(
          'El kilometraje final no puede ser inferior al kilometraje actual del vehículo',
        );
      }

      maintenance.status = MaintenanceStatus.COMPLETED;
      maintenance.workDone = updateStatusDto.workDone;
      maintenance.finalCost = updateStatusDto.finalCost;
      maintenance.finishedAt = new Date(updateStatusDto.finishedAt);
      maintenance.finalMileage = updateStatusDto.finalMileage;

      if (maintenance.vehicle) {
        maintenance.vehicle.status = VehicleStatus.AVAILABLE;
        maintenance.vehicle.mileage = updateStatusDto.finalMileage;
        await this.vehicleRepository.save(maintenance.vehicle);
      }

      return this.maintenanceRepository.save(maintenance);
    }

    throw new BadRequestException(`Invalid status transition to ${targetStatus}`);
  }

  async findAll(status?: MaintenanceStatus): Promise<MaintenanceEntity[]> {
    return this.maintenanceRepository.find({
      where: status ? { status } : {},
      relations: {
        vehicle: true,
        mechanic: true,
        workshop: true,
      },
      order: { scheduledDate: 'DESC' },
    });
  }

  async findByVehicle(vehicleId: number): Promise<MaintenanceEntity[]> {
    return this.maintenanceRepository.find({
      where: { vehicleId },
      relations: {
        vehicle: true,
        mechanic: true,
        workshop: true,
      },
      order: { scheduledDate: 'DESC' },
    });
  }

  async findByMechanic(mechanicId: number): Promise<MaintenanceEntity[]> {
    return this.maintenanceRepository.find({
      where: { mechanicId },
      relations: {
        vehicle: true,
        mechanic: true,
        workshop: true,
      },
      order: { scheduledDate: 'DESC' },
    });
  }

  async getVehicleExternalHistory(plate: string): Promise<{
    vehicle: VehicleEntity;
    maintenances: MaintenanceEntity[];
  }> {
    const vehicle = await this.vehicleRepository.findOneBy({ plate });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle with plate ${plate} not found`);
    }

    const maintenances = await this.maintenanceRepository.find({
      where: { vehicleId: vehicle.id },
      relations: {
        mechanic: true,
        workshop: true,
      },
      order: { scheduledDate: 'DESC' },
    });

    return {
      vehicle,
      maintenances,
    };
  }
}
