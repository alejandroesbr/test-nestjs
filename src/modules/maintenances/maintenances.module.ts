import { Module } from '@nestjs/common';
import { MaintenancesController } from './maintenances.controller.js';
import { MaintenancesService } from './maintenances.service.js';

@Module({
  controllers: [MaintenancesController],
  providers: [MaintenancesService]
})
export class MaintenancesModule {}
