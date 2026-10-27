import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { VehiclesModule } from './modules/vehicles/vehicles.module.js';
import { MechanicsModule } from './modules/mechanics/mechanics.module.js';
import { WorkshopsModule } from './modules/workshops/workshops.module.js';
import { MaintenancesModule } from './modules/maintenances/maintenances.module.js';

@Module({
  imports: [VehiclesModule, MechanicsModule, WorkshopsModule, MaintenancesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
