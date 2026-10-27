import bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
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

export function createSeedDataSource(): DataSource {
  return new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? '5432'),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_NAME ?? 'fleetcore',
    entities: [
      UserEntity,
      WorkshopEntity,
      VehicleEntity,
      MechanicEntity,
      MaintenanceEntity,
    ],
    synchronize: false,
  });
}

export async function runSeed(customDataSource?: DataSource): Promise<void> {
  const dataSource = customDataSource ?? createSeedDataSource();

  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }

  try {
    const userRepository = dataSource.getRepository(UserEntity);
    const workshopRepository = dataSource.getRepository(WorkshopEntity);
    const mechanicRepository = dataSource.getRepository(MechanicEntity);
    const vehicleRepository = dataSource.getRepository(VehicleEntity);
    const maintenanceRepository = dataSource.getRepository(MaintenanceEntity);

    // 1. Usuarios (1 ADMIN, 2 TECHNICIAN)
    const defaultPasswordHash = await bcrypt.hash('FleetCore2026!', 10);

    const seedUsersData = [
      {
        email: 'admin@fleetcore.com',
        password: defaultPasswordHash,
        role: Role.ADMIN,
      },
      {
        email: 'tech1@fleetcore.com',
        password: defaultPasswordHash,
        role: Role.TECHNICIAN,
      },
      {
        email: 'tech2@fleetcore.com',
        password: defaultPasswordHash,
        role: Role.TECHNICIAN,
      },
    ];

    const savedUsers: Record<string, UserEntity> = {};
    for (const userData of seedUsersData) {
      let user = await userRepository.findOneBy({ email: userData.email });
      if (!user) {
        user = userRepository.create(userData);
        user = await userRepository.save(user);
      }
      savedUsers[userData.email] = user;
    }

    // 2. Talleres (1 activo, 1 inactivo)
    const seedWorkshopsData = [
      {
        name: 'Taller Central Norte',
        address: 'Av. Industrial 450, Zona Norte',
        status: true,
      },
      {
        name: 'Taller Sur Inactivo',
        address: 'Calle 80 Sur #12-30',
        status: false,
      },
    ];

    const savedWorkshops: Record<string, WorkshopEntity> = {};
    for (const workshopData of seedWorkshopsData) {
      let workshop = await workshopRepository.findOneBy({
        name: workshopData.name,
      });
      if (!workshop) {
        workshop = workshopRepository.create(workshopData);
        workshop = await workshopRepository.save(workshop);
      }
      savedWorkshops[workshopData.name] = workshop;
    }

    const activeWorkshop = savedWorkshops['Taller Central Norte'];

    // 3. Mecánicos (2 activos vinculados a técnicos, 1 inactivo sin usuario)
    const seedMechanicsData = [
      {
        name: 'Carlos Ruiz',
        email: 'tech1@fleetcore.com',
        specialty: 'Motor y Transmisión Diesel',
        status: true,
        userId: savedUsers['tech1@fleetcore.com'].id,
      },
      {
        name: 'Ana Gómez',
        email: 'tech2@fleetcore.com',
        specialty: 'Frenos, Suspensión y Electrónica',
        status: true,
        userId: savedUsers['tech2@fleetcore.com'].id,
      },
      {
        name: 'Pedro Méndez',
        email: 'pedro.inactivo@fleetcore.com',
        specialty: 'Latonería y Pintura',
        status: false,
        userId: null,
      },
    ];

    const savedMechanics: Record<string, MechanicEntity> = {};
    for (const mechanicData of seedMechanicsData) {
      let mechanic = await mechanicRepository.findOneBy({
        email: mechanicData.email,
      });
      if (!mechanic) {
        mechanic = mechanicRepository.create(mechanicData);
        mechanic = await mechanicRepository.save(mechanic);
      }
      savedMechanics[mechanicData.email] = mechanic;
    }

    // 4. Vehículos (2 AVAILABLE, 1 IN_MAINTENANCE, 1 INACTIVE)
    const seedVehiclesData = [
      {
        plate: 'FLC-101',
        brand: 'Toyota',
        model: 'Hilux',
        year: 2023,
        mileage: 25500,
        status: VehicleStatus.AVAILABLE,
      },
      {
        plate: 'FLC-102',
        brand: 'Ford',
        model: 'Ranger',
        year: 2024,
        mileage: 12000,
        status: VehicleStatus.AVAILABLE,
      },
      {
        plate: 'FLC-201',
        brand: 'Chevrolet',
        model: 'NHR',
        year: 2022,
        mileage: 48000,
        status: VehicleStatus.IN_MAINTENANCE,
      },
      {
        plate: 'FLC-999',
        brand: 'Nissan',
        model: 'Frontier',
        year: 2019,
        mileage: 110000,
        status: VehicleStatus.INACTIVE,
      },
    ];

    const savedVehicles: Record<string, VehicleEntity> = {};
    for (const vehicleData of seedVehiclesData) {
      let vehicle = await vehicleRepository.findOne({
        where: { plate: vehicleData.plate },
        withDeleted: true,
      });
      if (!vehicle) {
        vehicle = vehicleRepository.create(vehicleData);
        vehicle = await vehicleRepository.save(vehicle);
      }
      savedVehicles[vehicleData.plate] = vehicle;
    }

    // 5. Mantenimientos (1 IN_PROGRESS para FLC-201, 1 COMPLETED para FLC-101)
    const seedMaintenancesData = [
      {
        vehicleId: savedVehicles['FLC-201'].id,
        mechanicId: savedMechanics['tech1@fleetcore.com'].id,
        workshopId: activeWorkshop.id,
        type: MaintenanceType.CORRECTIVE,
        description: 'Reemplazo de embrague y revisión de caja de cambios',
        mileage: 48000,
        scheduledDate: new Date('2026-10-27T09:00:00.000Z'),
        status: MaintenanceStatus.IN_PROGRESS,
        workDone: null,
        finalCost: null,
        finishedAt: null,
        finalMileage: null,
      },
      {
        vehicleId: savedVehicles['FLC-101'].id,
        mechanicId: savedMechanics['tech2@fleetcore.com'].id,
        workshopId: activeWorkshop.id,
        type: MaintenanceType.PREVENTIVE,
        description: 'Mantenimiento preventivo 25.000 km: aceite y filtros',
        mileage: 25000,
        scheduledDate: new Date('2026-10-15T08:00:00.000Z'),
        status: MaintenanceStatus.COMPLETED,
        workDone:
          'Cambio de aceite sintético 5W-30, filtro de aceite, filtro de aire y rotación de llantas',
        finalCost: 420.5,
        finishedAt: new Date('2026-10-15T14:30:00.000Z'),
        finalMileage: 25500,
      },
    ];

    for (const maintData of seedMaintenancesData) {
      const existing = await maintenanceRepository.findOneBy({
        vehicleId: maintData.vehicleId,
        description: maintData.description,
      });
      if (!existing) {
        const maintenance = maintenanceRepository.create(maintData);
        await maintenanceRepository.save(maintenance);
      }
    }
  } finally {
    if (!customDataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

const isDirectExecution =
  process.argv[1]?.endsWith('seed.ts') || process.argv[1]?.endsWith('seed.js');

if (isDirectExecution) {
  await runSeed();
  console.log('Seed completed successfully.');
}

