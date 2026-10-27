import { getMetadataArgsStorage } from 'typeorm';
import { Role } from '../common/constants/roles.enum.js';
import { UserEntity } from '../modules/auth/entities/user.entity.js';
import { WorkshopEntity } from '../modules/workshops/entities/workshop.entity.js';
import {
  VehicleEntity,
  VehicleStatus,
} from '../modules/vehicles/entities/vehicle.entity.js';
import { MechanicEntity } from '../modules/mechanics/entities/mechanic.entity.js';
import {
  MaintenanceEntity,
  MaintenanceStatus,
  MaintenanceType,
} from '../modules/maintenances/entities/maintenance.entity.js';

describe('Phase 2: ORM Entities & Metadata Mapping', () => {
  const storage = getMetadataArgsStorage();

  it('defines Role, VehicleStatus, MaintenanceType, and MaintenanceStatus enums', () => {
    expect(Role).toEqual({
      ADMIN: 'ADMIN',
      TECHNICIAN: 'TECHNICIAN',
    });
    expect(VehicleStatus).toEqual({
      AVAILABLE: 'AVAILABLE',
      IN_MAINTENANCE: 'IN_MAINTENANCE',
      INACTIVE: 'INACTIVE',
    });
    expect(MaintenanceType).toEqual({
      PREVENTIVE: 'PREVENTIVE',
      CORRECTIVE: 'CORRECTIVE',
    });
    expect(MaintenanceStatus).toEqual({
      SCHEDULED: 'SCHEDULED',
      IN_PROGRESS: 'IN_PROGRESS',
      COMPLETED: 'COMPLETED',
      CANCELLED: 'CANCELLED',
    });
  });

  it('maps UserEntity, WorkshopEntity, VehicleEntity, MechanicEntity, and MaintenanceEntity to plural snake_case tables', () => {
    const tableMap = new Map(
      storage.tables.map((t) => [t.target, t.name]),
    );

    expect(tableMap.get(UserEntity)).toBe('users');
    expect(tableMap.get(WorkshopEntity)).toBe('workshops');
    expect(tableMap.get(VehicleEntity)).toBe('vehicles');
    expect(tableMap.get(MechanicEntity)).toBe('mechanics');
    expect(tableMap.get(MaintenanceEntity)).toBe('maintenances');
  });

  it('configures select: false on UserEntity.password and soft delete on VehicleEntity.deletedAt', () => {
    const userPasswordCol = storage.columns.find(
      (c) => c.target === UserEntity && c.propertyName === 'password',
    );
    expect(userPasswordCol?.options.select).toBe(false);

    const vehicleDeletedAtCol = storage.columns.find(
      (c) => c.target === VehicleEntity && c.propertyName === 'deletedAt',
    );
    expect(vehicleDeletedAtCol?.mode).toBe('deleteDate');
    expect(vehicleDeletedAtCol?.options.name).toBe('deleted_at');
  });

  it('maps foreign keys with snake_case JoinColumns on MechanicEntity and MaintenanceEntity', () => {
    const joinColumns = storage.joinColumns.filter(
      (jc) => jc.target === MechanicEntity || jc.target === MaintenanceEntity,
    );
    const joinColumnNames = joinColumns.map((jc) => jc.name);

    expect(joinColumnNames).toEqual(
      expect.arrayContaining([
        'user_id',
        'vehicle_id',
        'mechanic_id',
        'workshop_id',
      ]),
    );
  });
});
