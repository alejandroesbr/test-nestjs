import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
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
  create(@Body() dto: CreateMechanicDto) {
    return this.mechanicsService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List all mechanics' })
  findAll() {
    return this.mechanicsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get mechanic by ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.mechanicsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update mechanic details' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateMechanicDto,
  ) {
    return this.mechanicsService.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Toggle or update mechanic operational status' })
  changeStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body('status') status?: boolean,
  ) {
    return this.mechanicsService.changeStatus(id, status);
  }
}
