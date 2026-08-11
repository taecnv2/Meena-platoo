import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { Unit } from './schemas/unit.schema';
import { UnitsService } from './units.service';

@Controller('units')
export class UnitsController {
  constructor(private readonly unitsService: UnitsService) {}

  @RequirePermission(PERMISSION_CODES.UNITS_READ)
  @Get()
  findAll(): Promise<Unit[]> {
    return this.unitsService.findAll();
  }

  @RequirePermission(PERMISSION_CODES.UNITS_READ)
  @Get(':id')
  findById(@Param('id') id: string): Promise<Unit> {
    return this.unitsService.findById(id);
  }

  @RequirePermission(PERMISSION_CODES.UNITS_CREATE)
  @Post()
  create(@Body() dto: CreateUnitDto): Promise<Unit> {
    return this.unitsService.create(dto);
  }

  @RequirePermission(PERMISSION_CODES.UNITS_UPDATE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateUnitDto): Promise<Unit> {
    return this.unitsService.update(id, dto);
  }
}
