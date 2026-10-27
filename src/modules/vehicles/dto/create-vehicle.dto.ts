import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { VehicleStatus } from '../entities/vehicle.entity.js';

export class CreateVehicleDto {
  @ApiProperty({ example: 'ABC-123', minLength: 6, maxLength: 10 })
  @IsString()
  @IsNotEmpty()
  @Length(6, 10)
  plate: string;

  @ApiProperty({ example: 'Toyota' })
  @IsString()
  @IsNotEmpty()
  brand: string;

  @ApiProperty({ example: 'Hilux' })
  @IsString()
  @IsNotEmpty()
  model: string;

  @ApiProperty({ example: 2023, minimum: 1900, maximum: 2100 })
  @IsInt()
  @Min(1900)
  @Max(2100)
  year: number;

  @ApiProperty({ example: 15000, minimum: 0 })
  @IsInt()
  @Min(0)
  mileage: number;

  @ApiPropertyOptional({ enum: VehicleStatus, default: VehicleStatus.AVAILABLE })
  @IsOptional()
  @IsEnum(VehicleStatus)
  status?: VehicleStatus;
}

