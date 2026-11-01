import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import type { RequestUser } from '../common/types/authenticated-request';
import { ExportService, type ExportFormat } from '../export/export.service';
import { CreateUnitDto } from './dto/create-unit.dto';
import { UpdateUnitDto } from './dto/update-unit.dto';
import { Unit } from './schemas/unit.schema';
import { UNIT_EXPORT_COLUMNS } from './unit-export.columns';
import { UnitsService } from './units.service';

@Controller('units')
export class UnitsController {
  constructor(
    private readonly unitsService: UnitsService,
    private readonly exportService: ExportService,
  ) {}

  @RequirePermission(PERMISSION_CODES.UNITS_READ)
  @Get()
  findAll(): Promise<Unit[]> {
    return this.unitsService.findAll();
  }

  @RequirePermission(PERMISSION_CODES.UNITS_EXPORT)
  @Get('export')
  async export(
    @Query('format') format: ExportFormat,
    @CurrentUser() user: RequestUser,
  ): Promise<StreamableFile> {
    const rows = await this.unitsService.findAll();
    const buffer = await this.exportService.toFile(
      format,
      rows,
      UNIT_EXPORT_COLUMNS,
      {
        title: 'รายชื่อหน่วยนับ',
        generatedAt: new Date(),
        generatedBy: user.username,
      },
    );
    return this.exportService.streamableFile(buffer, 'units', format);
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
