import { jest } from '@jest/globals';
import { DataSource, Repository } from 'typeorm';
import { Role } from '../../common/constants/roles.enum.js';
import { UserEntity } from '../../modules/auth/entities/user.entity.js';
import {
  MaintenanceEntity,
  MaintenanceStatus,
  MaintenanceType,
} from '../../modules/maintenances/entities/maintenance.entity.js';
import { MechanicEntity } from '../../modules/mechanics/entities/mechanic.entity.js';
import {
  VehicleEntity,
  VehicleStatus,
} from '../../modules/vehicles/entities/vehicle.entity.js';
import { WorkshopEntity } from '../../modules/workshops/entities/workshop.entity.js';
import { runSeed } from './seed.js';

describe('Phase 6: Idempotent Database Seeder (seed.ts)', () => {
  const createInMemoryStore = () => {
    const users: UserEntity[] = [];
    const workshops: WorkshopEntity[] = [];
    const mechanics: MechanicEntity[] = [];
    const vehicles: VehicleEntity[] = [];
    const maintenances: MaintenanceEntity[] = [];

    const matches = <T extends object>(item: T, where: Partial<T>): boolean =>
      Object.entries(where).every(
        ([k, v]) => (item as Record<string, unknown>)[k] === v,
      );

    const makeRepo = <T extends { id?: number }>(
      store: T[],
    ): Partial<Repository<T>> => ({
      findOneBy: jest.fn(async (where: Partial<T>) => {
        return store.find((item) => matches(item, where)) ?? null;
      }) as unknown as Repository<T>['findOneBy'],
      findOne: jest.fn(async (opts: { where: Partial<T> }) => {
        return store.find((item) => matches(item, opts.where)) ?? null;
      }) as unknown as Repository<T>['findOne'],
      create: jest.fn((dto: Partial<T>) => ({ ...dto }) as T) as unknown as Repository<T>['create'],
      save: jest.fn(async (entity: T) => {
        if (!entity.id) {
          entity.id = store.length + 1;
          store.push(entity);
        }
        return entity;
      }) as unknown as Repository<T>['save'],
    });

    const repoMap = new Map<unknown, unknown>([
      [UserEntity, makeRepo(users)],
      [WorkshopEntity, makeRepo(workshops)],
      [MechanicEntity, makeRepo(mechanics)],
      [VehicleEntity, makeRepo(vehicles)],
      [MaintenanceEntity, makeRepo(maintenances)],
    ]);

    const dataSource = {
      isInitialized: false,
      initialize: jest.fn(async function (this: { isInitialized: boolean }) {
        this.isInitialized = true;
        return this;
      }),
      destroy: jest.fn(async function (this: { isInitialized: boolean }) {
        this.isInitialized = false;
      }),
      getRepository: jest.fn((entity: unknown) => repoMap.get(entity)),
    } as unknown as DataSource;

    return {
      dataSource,
      users,
      workshops,
      mechanics,
      vehicles,
      maintenances,
    };
  };

  it('inserts required minimum dataset in topological order and remains idempotent on second run', async () => {
    const store = createInMemoryStore();

    // First execution
    await runSeed(store.dataSource);

    // 3 Users: 1 ADMIN and 2 TECHNICIAN with bcrypt hashed passwords
    expect(store.users).toHaveLength(3);
    expect(store.users.filter((u) => u.role === Role.ADMIN)).toHaveLength(1);
    expect(store.users.filter((u) => u.role === Role.TECHNICIAN)).toHaveLength(
      2,
    );
    expect(store.users.every((u) => u.password.startsWith('$2b$'))).toBe(true);

    // 2 Workshops: 1 active (true), 1 inactive (false)
    expect(store.workshops).toHaveLength(2);
    expect(store.workshops.some((w) => w.status === true)).toBe(true);
    expect(store.workshops.some((w) => w.status === false)).toBe(true);

    // 3 Mechanics: 2 active linked to technicians, 1 inactive without user
    expect(store.mechanics).toHaveLength(3);
    expect(
      store.mechanics.filter((m) => m.status === true && m.userId !== null),
    ).toHaveLength(2);
    expect(
      store.mechanics.filter((m) => m.status === false && m.userId === null),
    ).toHaveLength(1);

    // 4 Vehicles: 2 AVAILABLE, 1 IN_MAINTENANCE, 1 INACTIVE
    expect(store.vehicles).toHaveLength(4);
    expect(
      store.vehicles.filter((v) => v.status === VehicleStatus.AVAILABLE),
    ).toHaveLength(2);
    expect(
      store.vehicles.filter((v) => v.status === VehicleStatus.IN_MAINTENANCE),
    ).toHaveLength(1);
    expect(
      store.vehicles.filter((v) => v.status === VehicleStatus.INACTIVE),
    ).toHaveLength(1);

    // At least 2 Maintenances: 1 IN_PROGRESS and 1 COMPLETED (with all 4 closing fields)
    expect(store.maintenances.length).toBeGreaterThanOrEqual(2);
    const inProgress = store.maintenances.find(
      (m) => m.status === MaintenanceStatus.IN_PROGRESS,
    );
    const completed = store.maintenances.find(
      (m) => m.status === MaintenanceStatus.COMPLETED,
    );
    expect(inProgress).toBeDefined();
    expect(completed).toBeDefined();
    expect(completed?.type).toBe(MaintenanceType.PREVENTIVE);
    expect(completed?.workDone).toBeTruthy();
    expect(completed?.finalCost).toBeGreaterThan(0);
    expect(completed?.finishedAt).toBeInstanceOf(Date);
    expect(completed?.finalMileage).toBeGreaterThan(completed?.mileage ?? 0);

    // Second execution (Idempotency check: f(f(x)) = f(x))
    await runSeed(store.dataSource);

    expect(store.users).toHaveLength(3);
    expect(store.workshops).toHaveLength(2);
    expect(store.mechanics).toHaveLength(3);
    expect(store.vehicles).toHaveLength(4);
    expect(store.maintenances).toHaveLength(2);
  });
});

