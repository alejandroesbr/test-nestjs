import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '../../common/constants/roles.enum.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ApiKeyGuard } from '../../common/guards/api-key.guard.js';
import { CreateMaintenanceDto } from './dto/create-maintenance.dto.js';
import { UpdateMaintenanceStatusDto } from './dto/update-maintenance-status.dto.js';
import { MaintenanceStatus } from './entities/maintenance.entity.js';
import { MaintenancesService } from './maintenances.service.js';

@ApiTags('Maintenances')
@Controller('maintenances')
export class MaintenancesController {
  constructor(private readonly maintenancesService: MaintenancesService) {}

  @Post()
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Schedule a new maintenance order' })
  @ApiResponse({ status: 201, description: 'Maintenance order created' })
  @ApiResponse({
    status: 409,
    description: 'Vehicle unavailable or mechanic schedule conflict',
  })
  create(@Body() createMaintenanceDto: CreateMaintenanceDto) {
    return this.maintenancesService.create(createMaintenanceDto);
  }

  @Get()
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiQuery({ name: 'status', enum: MaintenanceStatus, required: false })
  @ApiOperation({ summary: 'List all maintenance orders with optional status filter' })
  findAll(@Query('status') status?: MaintenanceStatus) {
    return this.maintenancesService.findAll(status);
  }

  @Get('vehicle/:vehicleId')
  @ApiBearerAuth()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Get maintenance history for a specific vehicle ID' })
  findByVehicle(@Param('vehicleId', ParseIntPipe) vehicleId: number) {
    return this.maintenancesService.findByVehicle(vehicleId);
  }

  @Get('mechanic/:id')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({ summary: 'Get maintenance orders assigned to a mechanic' })
  findByMechanic(@Param('id', ParseIntPipe) id: number) {
    return this.maintenancesService.findByMechanic(id);
  }

  @Patch(':id/status')
  @ApiBearerAuth()
  @Roles(Role.ADMIN, Role.TECHNICIAN)
  @ApiOperation({
    summary:
      'Transition maintenance order status (IN_PROGRESS, CANCELLED, COMPLETED)',
  })
  @ApiResponse({ status: 200, description: 'Maintenance status updated' })
  @ApiResponse({
    status: 400,
    description: 'Missing closing fields or invalid mileage progression',
  })
  @ApiResponse({
    status: 409,
    description: 'Invalid state transition',
  })
  updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateStatusDto: UpdateMaintenanceStatusDto,
  ) {
    return this.maintenancesService.updateStatus(id, updateStatusDto);
  }

  @Public()
  @UseGuards(ApiKeyGuard)
  @ApiSecurity('x-api-key')
  @Get('external/history/:plate')
  @ApiOperation({
    summary: 'External M2M endpoint: query vehicle maintenance history by plate via x-api-key',
  })
  @ApiResponse({
    status: 200,
    description: 'Vehicle details and maintenance history',
  })
  @ApiResponse({ status: 401, description: 'Missing or invalid x-api-key' })
  @ApiResponse({ status: 404, description: 'Vehicle plate not found' })
  getVehicleExternalHistory(@Param('plate') plate: string) {
    return this.maintenancesService.getVehicleExternalHistory(plate);
  }
}
