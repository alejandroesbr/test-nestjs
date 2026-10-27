import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../common/constants/roles.enum.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CreateVehicleDto } from './dto/create-vehicle.dto.js';
import { UpdateVehicleDto } from './dto/update-vehicle.dto.js';
import { VehiclesService } from './vehicles.service.js';

@ApiTags('Vehicles')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new vehicle' })
  create(@Body() dto: CreateVehicleDto) {
    return this.vehiclesService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all active vehicles' })
  findAll() {
    return this.vehiclesService.findAll();
  }

  @Get('plate/:plate')
  @ApiOperation({ summary: 'Find vehicle by plate' })
  findByPlate(@Param('plate') plate: string) {
    return this.vehiclesService.findByPlate(plate);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Find vehicle by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.vehiclesService.findOneById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update vehicle properties' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVehicleDto,
  ) {
    return this.vehiclesService.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Logically delete vehicle (soft delete)' })
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.vehiclesService.softDelete(id);
  }
}
