import { ConflictException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { jest } from '@jest/globals';
import { Repository } from 'typeorm';
import { Role } from '../../common/constants/roles.enum.js';
import { ROLES_KEY } from '../../common/decorators/roles.decorator.js';
import { WorkshopEntity } from './entities/workshop.entity.js';
import { WorkshopsController } from './workshops.controller.js';
import { WorkshopsService } from './workshops.service.js';
import {
  VehicleEntity,
  VehicleStatus,
} from '../vehicles/entities/vehicle.entity.js';
import { VehiclesController } from '../vehicles/vehicles.controller.js';
import { VehiclesService } from '../vehicles/vehicles.service.js';
import { MechanicEntity } from '../mechanics/entities/mechanic.entity.js';
import { MechanicsController } from '../mechanics/mechanics.controller.js';
import { MechanicsService } from '../mechanics/mechanics.service.js';

describe('Phase 4: Master Catalogs (Workshops, Vehicles, Mechanics)', () => {
  describe('RBAC Controller Protection (@Roles(Role.ADMIN))', () => {
    it('enforces @Roles(Role.ADMIN) on WorkshopsController, VehiclesController, and MechanicsController', () => {
      const reflector = new Reflector();

      expect(reflector.get<Role[]>(ROLES_KEY, WorkshopsController)).toEqual([
        Role.ADMIN,
      ]);
      expect(reflector.get<Role[]>(ROLES_KEY, VehiclesController)).toEqual([
        Role.ADMIN,
      ]);
      expect(reflector.get<Role[]>(ROLES_KEY, MechanicsController)).toEqual([
        Role.ADMIN,
      ]);
    });
  });

  describe('WorkshopsService', () => {
    let service: WorkshopsService;
    let createMock: ReturnType<typeof jest.fn>;
    let saveMock: ReturnType<typeof jest.fn>;
    let findMock: ReturnType<typeof jest.fn>;
    let findOneByMock: ReturnType<typeof jest.fn>;

    beforeEach(() => {
      createMock = jest.fn((dto: Partial<WorkshopEntity>) => ({
        id: 1,
        status: true,
        ...dto,
      }));
      saveMock = jest.fn(async (entity: Partial<WorkshopEntity>) => ({
        id: 1,
        status: true,
        ...entity,
      }));
      findMock = jest.fn();
      findOneByMock = jest.fn();

      service = new WorkshopsService({
        create: createMock,
        save: saveMock,
        find: findMock,
        findOneBy: findOneByMock,
      } as unknown as Repository<WorkshopEntity>);
    });

    it('creates a workshop and lists only active workshops (status: true)', async () => {
      const created = await service.create({
        name: 'Taller Norte',
        address: 'Av. Industrial 123',
      });
      expect(created.name).toBe('Taller Norte');
      expect(created.status).toBe(true);

      findMock.mockResolvedValueOnce([created]);
      const activeList = await service.findActive();
      expect(findMock).toHaveBeenCalledWith({ where: { status: true } });
      expect(activeList).toHaveLength(1);
    });

    it('finds a workshop by id or throws NotFoundException, and deactivates logically (status = false)', async () => {
      findOneByMock.mockResolvedValueOnce(null);
      await expect(service.findOne(99)).rejects.toThrow(NotFoundException);

      findOneByMock.mockResolvedValueOnce({
        id: 1,
        name: 'Taller Norte',
        address: 'Av. Industrial 123',
        status: true,
      });

      const deactivated = await service.deactivate(1);
      expect(deactivated.status).toBe(false);
      expect(saveMock).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, status: false }),
      );
    });
  });

  describe('VehiclesService', () => {
    let service: VehiclesService;
    let findOneMock: ReturnType<typeof jest.fn>;
    let findOneByMock: ReturnType<typeof jest.fn>;
    let findMock: ReturnType<typeof jest.fn>;
    let createMock: ReturnType<typeof jest.fn>;
    let saveMock: ReturnType<typeof jest.fn>;
    let softRemoveMock: ReturnType<typeof jest.fn>;

    beforeEach(() => {
      findOneMock = jest.fn();
      findOneByMock = jest.fn();
      findMock = jest.fn();
      createMock = jest.fn((dto: Partial<VehicleEntity>) => ({
        id: 1,
        status: VehicleStatus.AVAILABLE,
        ...dto,
      }));
      saveMock = jest.fn(async (entity: Partial<VehicleEntity>) => ({
        id: 1,
        status: VehicleStatus.AVAILABLE,
        ...entity,
      }));
      softRemoveMock = jest.fn(async (entity: Partial<VehicleEntity>) => ({
        ...entity,
        deletedAt: new Date(),
      }));

      service = new VehiclesService({
        findOne: findOneMock,
        findOneBy: findOneByMock,
        find: findMock,
        create: createMock,
        save: saveMock,
        softRemove: softRemoveMock,
      } as unknown as Repository<VehicleEntity>);
    });

    it('prevents duplicate plates (including soft-deleted ones) with ConflictException and creates valid vehicles', async () => {
      findOneMock.mockResolvedValueOnce({ id: 1, plate: 'ABC-123' });
      await expect(
        service.create({
          plate: 'ABC-123',
          brand: 'Toyota',
          model: 'Hilux',
          year: 2023,
          mileage: 15000,
        }),
      ).rejects.toThrow(ConflictException);
      expect(findOneMock).toHaveBeenCalledWith({
        where: { plate: 'ABC-123' },
        withDeleted: true,
      });

      findOneMock.mockResolvedValueOnce(null);
      const created = await service.create({
        plate: 'XYZ-789',
        brand: 'Ford',
        model: 'Ranger',
        year: 2024,
        mileage: 5000,
      });
      expect(created.plate).toBe('XYZ-789');
      expect(created.status).toBe(VehicleStatus.AVAILABLE);
    });

    it('finds by id and by plate, updates fields, and executes softRemove on softDelete', async () => {
      findOneByMock.mockResolvedValueOnce(null);
      await expect(service.findByPlate('NOPE-00')).rejects.toThrow(
        NotFoundException,
      );

      const existing = {
        id: 5,
        plate: 'XYZ-789',
        brand: 'Ford',
        model: 'Ranger',
        year: 2024,
        mileage: 5000,
        status: VehicleStatus.AVAILABLE,
      } as VehicleEntity;

      findOneByMock.mockResolvedValueOnce(existing);
      const byPlate = await service.findByPlate('XYZ-789');
      expect(byPlate.id).toBe(5);

      findOneByMock.mockResolvedValueOnce(existing);
      const updated = await service.update(5, { mileage: 8500 });
      expect(updated.mileage).toBe(8500);

      findOneByMock.mockResolvedValueOnce(existing);
      await service.softDelete(5);
      expect(softRemoveMock).toHaveBeenCalledWith(existing);
    });
  });

  describe('MechanicsService', () => {
    let service: MechanicsService;
    let findOneByMock: ReturnType<typeof jest.fn>;
    let findMock: ReturnType<typeof jest.fn>;
    let createMock: ReturnType<typeof jest.fn>;
    let saveMock: ReturnType<typeof jest.fn>;

    beforeEach(() => {
      findOneByMock = jest.fn();
      findMock = jest.fn();
      createMock = jest.fn((dto: Partial<MechanicEntity>) => ({
        id: 1,
        status: true,
        ...dto,
      }));
      saveMock = jest.fn(async (entity: Partial<MechanicEntity>) => ({
        id: 1,
        status: true,
        ...entity,
      }));

      service = new MechanicsService({
        findOneBy: findOneByMock,
        find: findMock,
        create: createMock,
        save: saveMock,
      } as unknown as Repository<MechanicEntity>);
    });

    it('rejects duplicate email with ConflictException and creates mechanic when email is unique', async () => {
      findOneByMock.mockResolvedValueOnce({
        id: 1,
        email: 'carlos@fleetcore.com',
      });
      await expect(
        service.create({
          name: 'Carlos Ruiz',
          email: 'carlos@fleetcore.com',
          specialty: 'Frenos y Suspensión',
        }),
      ).rejects.toThrow(ConflictException);

      findOneByMock.mockResolvedValueOnce(null);
      const created = await service.create({
        name: 'Carlos Ruiz',
        email: 'carlos@fleetcore.com',
        specialty: 'Frenos y Suspensión',
      });
      expect(created.email).toBe('carlos@fleetcore.com');
      expect(created.status).toBe(true);
    });

    it('updates mechanic fields and toggles operational status', async () => {
      const mechanic = {
        id: 2,
        name: 'Ana Gómez',
        email: 'ana@fleetcore.com',
        specialty: 'Motor Diesel',
        status: true,
      } as MechanicEntity;

      findOneByMock.mockResolvedValueOnce(mechanic);
      const toggled = await service.changeStatus(2, false);
      expect(toggled.status).toBe(false);

      findOneByMock.mockResolvedValueOnce({ ...mechanic, status: false });
      const autoToggled = await service.changeStatus(2);
      expect(autoToggled.status).toBe(true);
    });
  });
});

