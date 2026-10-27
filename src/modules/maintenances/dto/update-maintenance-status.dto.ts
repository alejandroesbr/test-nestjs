import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { MaintenanceStatus } from '../entities/maintenance.entity.js';

export class UpdateMaintenanceStatusDto {
  @ApiProperty({
    enum: [
      MaintenanceStatus.IN_PROGRESS,
      MaintenanceStatus.CANCELLED,
      MaintenanceStatus.COMPLETED,
    ],
    example: MaintenanceStatus.IN_PROGRESS,
  })
  @IsEnum(MaintenanceStatus)
  status: MaintenanceStatus;

  @ApiPropertyOptional({
    example: 'Cambio de aceite sintético 5W-30 y filtro de aire',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  workDone?: string;

  @ApiPropertyOptional({ example: 350.5, minimum: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  finalCost?: number;

  @ApiPropertyOptional({ example: '2026-11-02T15:30:00.000Z' })
  @IsOptional()
  @IsDateString()
  finishedAt?: string;

  @ApiPropertyOptional({ example: 15500, minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  finalMileage?: number;
}

