import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { jest } from '@jest/globals';
import { Repository } from 'typeorm';
import { Role } from '../../common/constants/roles.enum.js';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator.js';
import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import {
  VehicleEntity,
  VehicleStatus,
} from '../vehicles/entities/vehicle.entity.js';
import { MechanicEntity } from '../mechanics/entities/mechanic.entity.js';
import { WorkshopEntity } from '../workshops/entities/workshop.entity.js';
import {
  MaintenanceEntity,
  MaintenanceStatus,
  MaintenanceType,
} from './entities/maintenance.entity.js';
import { MaintenancesController } from './maintenances.controller.js';
import { MaintenancesService } from './maintenances.service.js';

describe('Phase 5: Maintenances Core Domain (FSM, Overlap, Mileage, External API Key)', () => {
  let service: MaintenancesService;
  let maintenanceRepo: {
    findOne: ReturnType<typeof jest.fn>;
    find: ReturnType<typeof jest.fn>;
    create: ReturnType<typeof jest.fn>;
    save: ReturnType<typeof jest.fn>;
  };
  let vehicleRepo: {
    findOneBy: ReturnType<typeof jest.fn>;
    save: ReturnType<typeof jest.fn>;
  };
  let mechanicRepo: {
    findOneBy: ReturnType<typeof jest.fn>;
  };
  let workshopRepo: {
    findOneBy: ReturnType<typeof jest.fn>;
  };

  beforeEach(() => {
    maintenanceRepo = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((dto: Partial<MaintenanceEntity>) => ({
        id: 1,
        status: MaintenanceStatus.SCHEDULED,
        ...dto,
      })),
      save: jest.fn(async (entity: Partial<MaintenanceEntity>) => ({
        id: 1,
        status: MaintenanceStatus.SCHEDULED,
        ...entity,
      })),
    };
    vehicleRepo = {
      findOneBy: jest.fn(),
      save: jest.fn(async (v: Partial<VehicleEntity>) => v),
    };
    mechanicRepo = {
      findOneBy: jest.fn(),
    };
    workshopRepo = {
      findOneBy: jest.fn(),
    };

    service = new MaintenancesService(
      maintenanceRepo as unknown as Repository<MaintenanceEntity>,
      vehicleRepo as unknown as Repository<VehicleEntity>,
      mechanicRepo as unknown as Repository<MechanicEntity>,
      workshopRepo as unknown as Repository<WorkshopEntity>,
    );
  });

  describe('Opening a Maintenance Order (create)', () => {
    const validDto = {
      vehicleId: 10,
      mechanicId: 20,
      workshopId: 30,
      type: MaintenanceType.PREVENTIVE,
      description: 'Cambio de aceite y filtros',
      mileage: 15000,
      scheduledDate: '2026-11-01T10:00:00.000Z',
    };

    it('rejects when vehicle does not exist or is not AVAILABLE', async () => {
      vehicleRepo.findOneBy.mockResolvedValueOnce(null);
      await expect(service.create(validDto)).rejects.toThrow(NotFoundException);

      vehicleRepo.findOneBy.mockResolvedValueOnce({
        id: 10,
        status: VehicleStatus.IN_MAINTENANCE,
        mileage: 14000,
      });
      await expect(service.create(validDto)).rejects.toThrow(
        new ConflictException(
          'El vehículo no está disponible para mantenimiento',
        ),
      );
    });

    it('rejects when mechanic or workshop is inactive or missing', async () => {
      vehicleRepo.findOneBy.mockResolvedValue({
        id: 10,
        status: VehicleStatus.AVAILABLE,
        mileage: 14000,
      });

      mechanicRepo.findOneBy.mockResolvedValueOnce({ id: 20, status: false });
      await expect(service.create(validDto)).rejects.toThrow(ConflictException);

      mechanicRepo.findOneBy.mockResolvedValueOnce({ id: 20, status: true });
      workshopRepo.findOneBy.mockResolvedValueOnce({ id: 30, status: false });
      await expect(service.create(validDto)).rejects.toThrow(ConflictException);
    });

    it('rejects when reported mileage is lower than vehicle current mileage', async () => {
      vehicleRepo.findOneBy.mockResolvedValueOnce({
        id: 10,
        status: VehicleStatus.AVAILABLE,
        mileage: 20000,
      });
      mechanicRepo.findOneBy.mockResolvedValueOnce({ id: 20, status: true });
      workshopRepo.findOneBy.mockResolvedValueOnce({ id: 30, status: true });

      await expect(service.create(validDto)).rejects.toThrow(
        new BadRequestException(
          'El kilometraje registrado no puede ser inferior al actual del vehículo',
        ),
      );
    });

    it('rejects when mechanic already has an active maintenance at the same scheduledDate and creates order when clear', async () => {
      vehicleRepo.findOneBy.mockResolvedValue({
        id: 10,
        status: VehicleStatus.AVAILABLE,
        mileage: 14000,
      });
      mechanicRepo.findOneBy.mockResolvedValue({ id: 20, status: true });
      workshopRepo.findOneBy.mockResolvedValue({ id: 30, status: true });

      maintenanceRepo.findOne.mockResolvedValueOnce({
        id: 99,
        mechanicId: 20,
        status: MaintenanceStatus.SCHEDULED,
      });

      await expect(service.create(validDto)).rejects.toThrow(
        new ConflictException(
          'El mecánico ya tiene un mantenimiento asignado en este horario',
        ),
      );

      maintenanceRepo.findOne.mockResolvedValueOnce(null);
      const created = await service.create(validDto);
      expect(created.status).toBe(MaintenanceStatus.SCHEDULED);
      expect(created.vehicleId).toBe(10);
    });
  });

  describe('State Transitions (updateStatus FSM)', () => {
    it('blocks transitions from terminal states COMPLETED or CANCELLED', async () => {
      maintenanceRepo.findOne.mockResolvedValueOnce({
        id: 1,
        status: MaintenanceStatus.COMPLETED,
      });

      await expect(
        service.updateStatus(1, { status: MaintenanceStatus.IN_PROGRESS }),
      ).rejects.toThrow(
        new ConflictException(
          'Una orden finalizada o cancelada no puede ser modificada',
        ),
      );
    });

    it('transitions SCHEDULED -> IN_PROGRESS and updates vehicle status to IN_MAINTENANCE', async () => {
      const vehicle = {
        id: 10,
        mileage: 15000,
        status: VehicleStatus.AVAILABLE,
      } as VehicleEntity;

      maintenanceRepo.findOne.mockResolvedValueOnce({
        id: 1,
        status: MaintenanceStatus.SCHEDULED,
        vehicle,
      });

      const updated = await service.updateStatus(1, {
        status: MaintenanceStatus.IN_PROGRESS,
      });

      expect(updated.status).toBe(MaintenanceStatus.IN_PROGRESS);
      expect(vehicleRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 10,
          status: VehicleStatus.IN_MAINTENANCE,
        }),
      );
    });

    it('transitions SCHEDULED -> CANCELLED while keeping vehicle AVAILABLE', async () => {
      const vehicle = {
        id: 10,
        mileage: 15000,
        status: VehicleStatus.AVAILABLE,
      } as VehicleEntity;

      maintenanceRepo.findOne.mockResolvedValueOnce({
        id: 1,
        status: MaintenanceStatus.SCHEDULED,
        vehicle,
      });

      const updated = await service.updateStatus(1, {
        status: MaintenanceStatus.CANCELLED,
      });

      expect(updated.status).toBe(MaintenanceStatus.CANCELLED);
    });

    it('transitions IN_PROGRESS -> COMPLETED only when closing fields and valid finalMileage are provided, restoring vehicle to AVAILABLE', async () => {
      const vehicle = {
        id: 10,
        mileage: 15000,
        status: VehicleStatus.IN_MAINTENANCE,
      } as VehicleEntity;

      maintenanceRepo.findOne.mockResolvedValue({
        id: 1,
        status: MaintenanceStatus.IN_PROGRESS,
        mileage: 15000,
        vehicle,
      });

      await expect(
        service.updateStatus(1, { status: MaintenanceStatus.COMPLETED }),
      ).rejects.toThrow(
        new BadRequestException('Debe registrar todos los datos de finalización'),
      );

      await expect(
        service.updateStatus(1, {
          status: MaintenanceStatus.COMPLETED,
          workDone: 'Cambio completo',
          finalCost: 350,
          finishedAt: '2026-11-02T15:00:00.000Z',
          finalMileage: 14000,
        }),
      ).rejects.toThrow(BadRequestException);

      const completed = await service.updateStatus(1, {
        status: MaintenanceStatus.COMPLETED,
        workDone: 'Cambio completo',
        finalCost: 350,
        finishedAt: '2026-11-02T15:00:00.000Z',
        finalMileage: 15500,
      });

      expect(completed.status).toBe(MaintenanceStatus.COMPLETED);
      expect(completed.finalCost).toBe(350);
      expect(vehicleRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 10,
          status: VehicleStatus.AVAILABLE,
          mileage: 15500,
        }),
      );
    });
  });

  describe('External History & Controller Decorators', () => {
    it('marks external history endpoint with @Public() and returns vehicle + maintenance history by plate', async () => {
      const reflector = new Reflector();
      const isPublic = reflector.get<boolean>(
        IS_PUBLIC_KEY,
        MaintenancesController.prototype.getVehicleExternalHistory,
      );
      const statusRoles = reflector.get<Role[]>(
        ROLES_KEY,
        MaintenancesController.prototype.updateStatus,
      );

      expect(isPublic).toBe(true);
      expect(statusRoles).toEqual([Role.ADMIN, Role.TECHNICIAN]);

      vehicleRepo.findOneBy.mockResolvedValueOnce({
        id: 10,
        plate: 'ABC-123',
        brand: 'Toyota',
        model: 'Hilux',
        year: 2023,
        mileage: 15500,
        status: VehicleStatus.AVAILABLE,
      });
      maintenanceRepo.find.mockResolvedValueOnce([
        {
          id: 1,
          type: MaintenanceType.PREVENTIVE,
          description: 'Cambio de aceite',
          status: MaintenanceStatus.COMPLETED,
          finalCost: 350,
        },
      ]);

      const history = await service.getVehicleExternalHistory('ABC-123');
      expect(history.vehicle.plate).toBe('ABC-123');
      expect(history.maintenances).toHaveLength(1);
    });
  });
});

