import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter.js';
import { ApiKeyGuard } from '../src/common/guards/api-key.guard.js';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../src/common/guards/roles.guard.js';
import { ResponseTransformInterceptor } from '../src/common/interceptors/response-transform.interceptor.js';
import { runSeed } from '../src/database/seeds/seed.js';
import { AuthController } from '../src/modules/auth/auth.controller.js';
import { AuthService } from '../src/modules/auth/auth.service.js';
import { UserEntity } from '../src/modules/auth/entities/user.entity.js';
import { JwtStrategy } from '../src/modules/auth/strategies/jwt.strategy.js';
import { MaintenanceEntity } from '../src/modules/maintenances/entities/maintenance.entity.js';
import { MaintenancesController } from '../src/modules/maintenances/maintenances.controller.js';
import { MaintenancesService } from '../src/modules/maintenances/maintenances.service.js';
import { MechanicEntity } from '../src/modules/mechanics/entities/mechanic.entity.js';
import { MechanicsController } from '../src/modules/mechanics/mechanics.controller.js';
import { MechanicsService } from '../src/modules/mechanics/mechanics.service.js';
import { VehicleEntity } from '../src/modules/vehicles/entities/vehicle.entity.js';
import { VehiclesController } from '../src/modules/vehicles/vehicles.controller.js';
import { VehiclesService } from '../src/modules/vehicles/vehicles.service.js';
import { WorkshopEntity } from '../src/modules/workshops/entities/workshop.entity.js';
import { WorkshopsController } from '../src/modules/workshops/workshops.controller.js';
import { WorkshopsService } from '../src/modules/workshops/workshops.service.js';
import { DataSource } from 'typeorm';

describe('FleetCore API Smoke Tests (e2e)', () => {
  let app: INestApplication<App>;
  let adminToken: string;

  const users: UserEntity[] = [];
  const workshops: WorkshopEntity[] = [];
  const mechanics: MechanicEntity[] = [];
  const vehicles: VehicleEntity[] = [];
  const maintenances: MaintenanceEntity[] = [];

  const matchesWhere = <T extends object>(item: T, where: Record<string, unknown>): boolean => {
    return Object.entries(where).every(([k, v]) => {
      const actual = (item as Record<string, unknown>)[k];
      if (v && typeof v === 'object' && '_type' in v && (v as { _type: string })._type === 'in') {
        const values = (v as unknown as { _value: unknown[] })._value;
        return values.includes(actual);
      }
      if (actual instanceof Date && v instanceof Date) {
        return actual.getTime() === v.getTime();
      }
      return actual === v;
    });
  };

  const makeInMemoryRepo = <T extends { id?: number; deletedAt?: Date | null }>(
    store: T[],
    attachRelations?: (item: T) => T,
  ) => ({
    find: async (opts?: { where?: Record<string, unknown> }) => {
      const list = store.filter((item) => {
        if (item.deletedAt) return false;
        return opts?.where ? matchesWhere(item, opts.where) : true;
      });
      return attachRelations ? list.map(attachRelations) : list;
    },
    findOneBy: async (where: Record<string, unknown>) => {
      const found =
        store.find((item) => !item.deletedAt && matchesWhere(item, where)) ??
        null;
      return found && attachRelations ? attachRelations(found) : found;
    },
    findOne: async (opts: {
      where: Record<string, unknown>;
      withDeleted?: boolean;
    }) => {
      const found =
        store.find(
          (item) =>
            (opts.withDeleted || !item.deletedAt) &&
            matchesWhere(item, opts.where),
        ) ?? null;
      return found && attachRelations ? attachRelations(found) : found;
    },
    create: (dto: Partial<T>) => ({ ...dto }) as T,
    save: async (entity: T) => {
      if (!entity.id) {
        entity.id = store.length + 1;
        store.push(entity);
      } else {
        const idx = store.findIndex((i) => i.id === entity.id);
        if (idx >= 0) store[idx] = entity;
      }
      return entity;
    },
    softRemove: async (entity: T) => {
      entity.deletedAt = new Date();
      return entity;
    },
  });

  beforeAll(async () => {
    process.env.JWT_SECRET = 'e2e-test-jwt-secret';
    process.env.API_KEYS = 'demo-key-partner-1,demo-key-partner-2';

    const userRepo = makeInMemoryRepo(users);
    const workshopRepo = makeInMemoryRepo(workshops);
    const mechanicRepo = makeInMemoryRepo(mechanics);
    const vehicleRepo = makeInMemoryRepo(vehicles);
    const maintenanceRepo = makeInMemoryRepo(maintenances, (m) => ({
      ...m,
      vehicle: vehicles.find((v) => v.id === m.vehicleId) as VehicleEntity,
      mechanic: mechanics.find((mc) => mc.id === m.mechanicId) as MechanicEntity,
      workshop: workshops.find((w) => w.id === m.workshopId) as WorkshopEntity,
    }));

    const repoMap = new Map<unknown, unknown>([
      [UserEntity, userRepo],
      [WorkshopEntity, workshopRepo],
      [MechanicEntity, mechanicRepo],
      [VehicleEntity, vehicleRepo],
      [MaintenanceEntity, maintenanceRepo],
    ]);

    const fakeDataSource = {
      isInitialized: true,
      initialize: async () => fakeDataSource,
      destroy: async () => {},
      getRepository: (entity: unknown) => repoMap.get(entity),
    } as unknown as DataSource;

    await runSeed(fakeDataSource);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.registerAsync({
          inject: [ConfigService],
          useFactory: () => ({
            secret: 'e2e-test-jwt-secret',
            signOptions: { expiresIn: '1h' },
          }),
        }),
      ],
      controllers: [
        AuthController,
        WorkshopsController,
        VehiclesController,
        MechanicsController,
        MaintenancesController,
      ],
      providers: [
        AuthService,
        JwtStrategy,
        WorkshopsService,
        VehiclesService,
        MechanicsService,
        MaintenancesService,
        ApiKeyGuard,
        { provide: APP_GUARD, useClass: JwtAuthGuard },
        { provide: APP_GUARD, useClass: RolesGuard },
        { provide: getRepositoryToken(UserEntity), useValue: userRepo },
        { provide: getRepositoryToken(WorkshopEntity), useValue: workshopRepo },
        { provide: getRepositoryToken(MechanicEntity), useValue: mechanicRepo },
        { provide: getRepositoryToken(VehicleEntity), useValue: vehicleRepo },
        {
          provide: getRepositoryToken(MaintenanceEntity),
          useValue: maintenanceRepo,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalInterceptors(new ResponseTransformInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('7.1 Authenticates seeded ADMIN user and wraps response with ResponseTransformInterceptor', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: 'admin@fleetcore.com',
        password: 'FleetCore2026!',
      })
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.statusCode).toBe(200);
    expect(res.body.data.accessToken).toBeDefined();
    adminToken = res.body.data.accessToken;
  });

  it('7.1 Queries active workshops, vehicles, and mechanics with ADMIN Bearer token', async () => {
    const wsRes = await request(app.getHttpServer())
      .get('/workshops')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(wsRes.body.data).toHaveLength(1);
    expect(wsRes.body.data[0].name).toBe('Taller Central Norte');

    const vehRes = await request(app.getHttpServer())
      .get('/vehicles/plate/FLC-101')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(vehRes.body.data.plate).toBe('FLC-101');
  });

  it('7.1 Executes full Maintenance FSM (SCHEDULED -> IN_PROGRESS -> COMPLETED) and updates vehicle mileage', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/maintenances')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vehicleId: 2, // FLC-102 (AVAILABLE, mileage 12000)
        mechanicId: 2, // Ana Gómez (active)
        workshopId: 1, // Taller Central Norte (active)
        type: 'PREVENTIVE',
        description: 'Mantenimiento 12.000 km',
        mileage: 12000,
        scheduledDate: '2026-11-10T10:00:00.000Z',
      })
      .expect(201);

    const maintId = createRes.body.data.id;
    expect(createRes.body.data.status).toBe('SCHEDULED');

    await request(app.getHttpServer())
      .patch(`/maintenances/${maintId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);

    const vehDuring = await request(app.getHttpServer())
      .get('/vehicles/2')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(vehDuring.body.data.status).toBe('IN_MAINTENANCE');

    await request(app.getHttpServer())
      .patch(`/maintenances/${maintId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'COMPLETED',
        workDone: 'Cambio de aceite y revisión de frenos',
        finalCost: 280,
        finishedAt: '2026-11-10T14:00:00.000Z',
        finalMileage: 12450,
      })
      .expect(200);

    const vehAfter = await request(app.getHttpServer())
      .get('/vehicles/2')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(vehAfter.body.data.status).toBe('AVAILABLE');
    expect(vehAfter.body.data.mileage).toBe(12450);
  });

  it('7.2 Rejects negative domain cases with 400/409 (no 500 Internal Server Errors)', async () => {
    // Inactive vehicle (FLC-999, id 4) -> 409 Conflict
    const inactiveRes = await request(app.getHttpServer())
      .post('/maintenances')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vehicleId: 4,
        mechanicId: 1,
        workshopId: 1,
        type: 'CORRECTIVE',
        description: 'Intento en vehículo inactivo',
        mileage: 110000,
        scheduledDate: '2026-11-12T10:00:00.000Z',
      })
      .expect(409);
    expect(inactiveRes.body.success).toBe(false);

    // Invalid lower mileage -> 400 Bad Request
    await request(app.getHttpServer())
      .post('/maintenances')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vehicleId: 1, // FLC-101 has 25500 km
        mechanicId: 2,
        workshopId: 1,
        type: 'PREVENTIVE',
        description: 'Odómetro menor',
        mileage: 10000,
        scheduledDate: '2026-11-15T10:00:00.000Z',
      })
      .expect(400);

    // Duplicate vehicle plate -> 409 Conflict
    await request(app.getHttpServer())
      .post('/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        plate: 'FLC-101',
        brand: 'Toyota',
        model: 'Hilux',
        year: 2023,
        mileage: 25500,
      })
      .expect(409);
  });

  it('7.1 Serves external vehicle history via x-api-key without JWT token', async () => {
    const extRes = await request(app.getHttpServer())
      .get('/maintenances/external/history/FLC-101')
      .set('x-api-key', 'demo-key-partner-1')
      .expect(200);

    expect(extRes.body.success).toBe(true);
    expect(extRes.body.data.vehicle.plate).toBe('FLC-101');
    expect(extRes.body.data.maintenances.length).toBeGreaterThanOrEqual(1);
  });
});
