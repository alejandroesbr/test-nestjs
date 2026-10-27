import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MechanicEntity } from '../mechanics/entities/mechanic.entity.js';
import {
  VehicleEntity,
  VehicleStatus,
} from '../vehicles/entities/vehicle.entity.js';
import { WorkshopEntity } from '../workshops/entities/workshop.entity.js';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto.js';
import { UpdateMaintenanceStatusDto } from './dto/update-maintenance-status.dto.js';
import {
  MaintenanceEntity,
  MaintenanceStatus,
} from './entities/maintenance.entity.js';

const RELATIONS = { vehicle: true, mechanic: true, workshop: true } as const;
const ACTIVE_STATUSES = [
  MaintenanceStatus.SCHEDULED,
  MaintenanceStatus.IN_PROGRESS,
];
const WINDOW_MS = 90 * 60 * 1000;

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

  async create(dto: CreateMaintenanceDto): Promise<MaintenanceEntity> {
    const vehicle = await this.vehicleRepository.findOneBy({
      id: dto.vehicleId,
    });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle with ID ${dto.vehicleId} not found`);
    }
    if (vehicle.status !== VehicleStatus.AVAILABLE) {
      throw new ConflictException(
        'El vehículo no está disponible para mantenimiento',
      );
    }

    const mechanic = await this.mechanicRepository.findOneBy({
      id: dto.mechanicId,
    });
    if (!mechanic || !mechanic.status) {
      throw new ConflictException(
        'El mecánico no existe o no se encuentra activo',
      );
    }

    const workshop = await this.workshopRepository.findOneBy({
      id: dto.workshopId,
    });
    if (!workshop || !workshop.status) {
      throw new ConflictException(
        'El taller no existe o no se encuentra activo',
      );
    }

    if (dto.mileage < vehicle.mileage) {
      throw new BadRequestException(
        'El kilometraje registrado no puede ser inferior al actual del vehículo',
      );
    }

    const scheduledDate = new Date(dto.scheduledDate);

    // Validación de cruce de horarios (intervalos semiabiertos de Allen [s1, e1) y [s2, e2) de 90 min)
    const exactOverlap = await this.maintenanceRepository.findOne({
      where: {
        mechanicId: dto.mechanicId,
        scheduledDate,
        status: In(ACTIVE_STATUSES),
      },
    });
    const activeOrders =
      (await this.maintenanceRepository.find({
        where: { mechanicId: dto.mechanicId, status: In(ACTIVE_STATUSES) },
      })) ?? [];

    const startMs = scheduledDate.getTime();
    const hasWindowOverlap = activeOrders.some((order) => {
      if (!order.scheduledDate) return false;
      const existingStart = new Date(order.scheduledDate).getTime();
      return startMs < existingStart + WINDOW_MS && startMs + WINDOW_MS > existingStart;
    });

    if (exactOverlap || hasWindowOverlap) {
      throw new ConflictException(
        'El mecánico ya tiene un mantenimiento asignado en este horario',
      );
    }

    return this.maintenanceRepository.save(
      this.maintenanceRepository.create({
        vehicleId: dto.vehicleId,
        mechanicId: dto.mechanicId,
        workshopId: dto.workshopId,
        type: dto.type,
        description: dto.description,
        mileage: dto.mileage,
        scheduledDate,
        status: MaintenanceStatus.SCHEDULED,
      }),
    );
  }

  async updateStatus(
    id: number,
    dto: UpdateMaintenanceStatusDto,
  ): Promise<MaintenanceEntity> {
    const maintenance = await this.maintenanceRepository.findOne({
      where: { id },
      relations: RELATIONS,
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

    if (dto.status === MaintenanceStatus.IN_PROGRESS) {
      if (maintenance.status !== MaintenanceStatus.SCHEDULED) {
        throw new ConflictException(
          'Solo una orden en estado SCHEDULED puede pasar a IN_PROGRESS',
        );
      }
      maintenance.status = MaintenanceStatus.IN_PROGRESS;
      if (maintenance.vehicle) {
        maintenance.vehicle.status = VehicleStatus.IN_MAINTENANCE;
      }
      return this.saveWithVehicle(maintenance);
    }

    if (dto.status === MaintenanceStatus.CANCELLED) {
      if (maintenance.status !== MaintenanceStatus.SCHEDULED) {
        throw new ConflictException(
          'Solo una orden en estado SCHEDULED puede ser cancelada',
        );
      }
      maintenance.status = MaintenanceStatus.CANCELLED;
      return this.maintenanceRepository.save(maintenance);
    }

    if (dto.status === MaintenanceStatus.COMPLETED) {
      if (maintenance.status !== MaintenanceStatus.IN_PROGRESS) {
        throw new ConflictException(
          'Solo una orden en estado IN_PROGRESS puede ser completada',
        );
      }
      if (
        !dto.workDone ||
        dto.finalCost === undefined ||
        !dto.finishedAt ||
        dto.finalMileage === undefined
      ) {
        throw new BadRequestException(
          'Debe registrar todos los datos de finalización',
        );
      }

      const currentMileage = maintenance.vehicle?.mileage ?? maintenance.mileage;
      if (dto.finalMileage < currentMileage) {
        throw new BadRequestException(
          'El kilometraje final no puede ser inferior al kilometraje actual del vehículo',
        );
      }

      Object.assign(maintenance, {
        status: MaintenanceStatus.COMPLETED,
        workDone: dto.workDone,
        finalCost: dto.finalCost,
        finishedAt: new Date(dto.finishedAt),
        finalMileage: dto.finalMileage,
      });

      if (maintenance.vehicle) {
        maintenance.vehicle.status = VehicleStatus.AVAILABLE;
        maintenance.vehicle.mileage = dto.finalMileage;
      }
      return this.saveWithVehicle(maintenance);
    }

    throw new BadRequestException(`Invalid status transition to ${dto.status}`);
  }

  /**
   * Transacción atómica ACID: sincroniza la mutación del mantenimiento y del vehículo
   * en una sola unidad de trabajo para evitar estados inconsistentes ante fallos parciales.
   */
  private async saveWithVehicle(
    maintenance: MaintenanceEntity,
  ): Promise<MaintenanceEntity> {
    if (this.maintenanceRepository.manager?.transaction) {
      return this.maintenanceRepository.manager.transaction(async (em) => {
        if (maintenance.vehicle) {
          await em.save(VehicleEntity, maintenance.vehicle);
        }
        return em.save(MaintenanceEntity, maintenance);
      });
    }
    if (maintenance.vehicle) {
      await this.vehicleRepository.save(maintenance.vehicle);
    }
    return this.maintenanceRepository.save(maintenance);
  }

  findAll(status?: MaintenanceStatus): Promise<MaintenanceEntity[]> {
    return this.maintenanceRepository.find({
      where: status ? { status } : {},
      relations: RELATIONS,
      order: { scheduledDate: 'DESC' },
    });
  }

  findActive(): Promise<MaintenanceEntity[]> {
    return this.maintenanceRepository.find({
      where: { status: In(ACTIVE_STATUSES) },
      relations: RELATIONS,
      order: { scheduledDate: 'DESC' },
    });
  }

  findByVehicle(vehicleId: number): Promise<MaintenanceEntity[]> {
    return this.maintenanceRepository.find({
      where: { vehicleId },
      relations: RELATIONS,
      order: { scheduledDate: 'DESC' },
    });
  }

  findByMechanic(mechanicId: number): Promise<MaintenanceEntity[]> {
    return this.maintenanceRepository.find({
      where: { mechanicId },
      relations: RELATIONS,
      order: { scheduledDate: 'DESC' },
    });
  }

  async getVehicleExternalHistory(plate: string) {
    const vehicle = await this.vehicleRepository.findOneBy({ plate });
    if (!vehicle) {
      throw new NotFoundException(`Vehicle with plate ${plate} not found`);
    }
    const maintenances = await this.maintenanceRepository.find({
      where: { vehicleId: vehicle.id },
      relations: { mechanic: true, workshop: true },
      order: { scheduledDate: 'DESC' },
    });
    return { vehicle, maintenances };
  }
}
