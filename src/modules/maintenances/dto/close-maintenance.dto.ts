import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
} from 'class-validator';

export class CloseMaintenanceDto {
  @ApiProperty({ example: 'Cambio de aceite sintético 5W-30 y filtro de aire' })
  @IsString()
  @IsNotEmpty()
  workDone: string;

  @ApiProperty({ example: 350.5, minimum: 0 })
  @IsNumber()
  @Min(0)
  finalCost: number;

  @ApiProperty({ example: '2026-11-02T15:30:00.000Z' })
  @IsDateString()
  @IsNotEmpty()
  finishedAt: string;

  @ApiProperty({ example: 15500, minimum: 0 })
  @IsInt()
  @Min(0)
  finalMileage: number;
}

