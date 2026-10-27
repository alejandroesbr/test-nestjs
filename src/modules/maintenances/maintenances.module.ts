import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehicleEntity } from '../vehicles/entities/vehicle.entity.js';
import { MechanicEntity } from '../mechanics/entities/mechanic.entity.js';
import { WorkshopEntity } from '../workshops/entities/workshop.entity.js';
import { MaintenanceEntity } from './entities/maintenance.entity.js';
import { MaintenancesController } from './maintenances.controller.js';
import { MaintenancesService } from './maintenances.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MaintenanceEntity,
      VehicleEntity,
      MechanicEntity,
      WorkshopEntity,
    ]),
  ],
  controllers: [MaintenancesController],
  providers: [MaintenancesService],
})
export class MaintenancesModule {}
