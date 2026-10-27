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
import { CreateWorkshopDto } from './dto/create-workshop.dto.js';
import { WorkshopsService } from './workshops.service.js';

@ApiTags('Workshops')
@ApiBearerAuth()
@Roles(Role.ADMIN)
@Controller('workshops')
export class WorkshopsController {
  constructor(private readonly workshopsService: WorkshopsService) {}

  @Post()
  @ApiOperation({ summary: 'Register a new workshop' })
  @ApiResponse({ status: 201, description: 'Workshop created successfully' })
  create(@Body() createWorkshopDto: CreateWorkshopDto) {
    return this.workshopsService.create(createWorkshopDto);
  }

  @Get()
  @ApiOperation({ summary: 'List all active workshops' })
  @ApiResponse({ status: 200, description: 'List of active workshops' })
  findActive() {
    return this.workshopsService.findActive();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get workshop by ID' })
  @ApiResponse({ status: 200, description: 'Workshop found' })
  @ApiResponse({ status: 404, description: 'Workshop not found' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.workshopsService.findOne(id);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Logically deactivate a workshop (status = false)' })
  @ApiResponse({ status: 200, description: 'Workshop deactivated' })
  @ApiResponse({ status: 404, description: 'Workshop not found' })
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.workshopsService.deactivate(id);
  }
}
