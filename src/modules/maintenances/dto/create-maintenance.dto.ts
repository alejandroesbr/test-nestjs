import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  Min,
} from 'class-validator';
import { MaintenanceType } from '../entities/maintenance.entity.js';

export class CreateMaintenanceDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  @IsNotEmpty()
  vehicleId: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @IsNotEmpty()
  mechanicId: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  @IsNotEmpty()
  workshopId: number;

  @ApiProperty({ enum: MaintenanceType, example: MaintenanceType.PREVENTIVE })
  @IsEnum(MaintenanceType)
  type: MaintenanceType;

  @ApiProperty({ example: 'Cambio de aceite, filtros y revisión general' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiProperty({ example: 15000, minimum: 0 })
  @IsInt()
  @Min(0)
  mileage: number;

  @ApiProperty({ example: '2026-11-01T10:00:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  scheduledDate: string;
}

