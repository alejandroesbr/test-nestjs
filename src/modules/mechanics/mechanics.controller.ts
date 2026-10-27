import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '../../common/constants/roles.enum.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { CreateMechanicDto } from './dto/create-mechanic.dto.js';
import { UpdateMechanicDto } from './dto/update-mechanic.dto.js';
import { MechanicsService } from './mechanics.service.js';

@ApiTags('Mechanics')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('mechanics')
export class MechanicsController {
  constructor(private readonly mechanicsService: MechanicsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new mechanic' })
  @ApiResponse({ status: 201, description: 'Mechanic created successfully' })
  @ApiResponse({ status: 409, description: 'Mechanic email already exists' })
  create(@Body() createMechanicDto: CreateMechanicDto) {
    return this.mechanicsService.create(createMechanicDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all mechanics' })
  @ApiResponse({ status: 200, description: 'List of mechanics' })
  findAll() {
    return this.mechanicsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get mechanic by ID' })
  @ApiResponse({ status: 200, description: 'Mechanic found' })
  @ApiResponse({ status: 404, description: 'Mechanic not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.mechanicsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update mechanic details' })
  @ApiResponse({ status: 200, description: 'Mechanic updated' })
  @ApiResponse({ status: 404, description: 'Mechanic not found' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMechanicDto: UpdateMechanicDto,
  ) {
    return this.mechanicsService.update(id, updateMechanicDto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Toggle or update mechanic operational status' })
  @ApiResponse({ status: 200, description: 'Mechanic status updated' })
  @ApiResponse({ status: 404, description: 'Mechanic not found' })
  changeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status?: boolean,
  ) {
    return this.mechanicsService.changeStatus(id, status);
  }
}
