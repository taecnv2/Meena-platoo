import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneStatusDto } from './dto/update-zone-status.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { Zone } from './schemas/zone.schema';
import { ZonesService } from './zones.service';

@Controller('zones')
export class ZonesController {
  constructor(private readonly zonesService: ZonesService) {}

  @RequirePermission(PERMISSION_CODES.ZONES_READ)
  @Get()
  findAll(): Promise<Zone[]> {
    return this.zonesService.findAll();
  }

  @RequirePermission(PERMISSION_CODES.ZONES_READ)
  @Get(':id')
  findById(@Param('id') id: string): Promise<Zone> {
    return this.zonesService.findById(id);
  }

  @RequirePermission(PERMISSION_CODES.ZONES_CREATE)
  @Post()
  create(@Body() dto: CreateZoneDto): Promise<Zone> {
    return this.zonesService.create(dto);
  }

  @RequirePermission(PERMISSION_CODES.ZONES_UPDATE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateZoneDto): Promise<Zone> {
    return this.zonesService.update(id, dto);
  }

  @RequirePermission(PERMISSION_CODES.ZONES_DISABLE)
  @Patch(':id/status')
  setStatus(
    @Param('id') id: string,
    @Body() dto: UpdateZoneStatusDto,
  ): Promise<Zone> {
    return this.zonesService.setStatus(id, dto.status);
  }
}
