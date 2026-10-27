import { Module } from '@nestjs/common';
import { MechanicsController } from './mechanics.controller.js';
import { MechanicsService } from './mechanics.service.js';

@Module({
  controllers: [MechanicsController],
  providers: [MechanicsService]
})
export class MechanicsModule {}
