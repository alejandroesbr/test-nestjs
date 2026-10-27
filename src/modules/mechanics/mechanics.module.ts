import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MechanicEntity } from './entities/mechanic.entity.js';
import { MechanicsController } from './mechanics.controller.js';
import { MechanicsService } from './mechanics.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([MechanicEntity])],
  controllers: [MechanicsController],
  providers: [MechanicsService],
  exports: [MechanicsService, TypeOrmModule],
})
export class MechanicsModule {}
