import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import type { Types } from 'mongoose';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import type { RequestUser } from '../common/types/authenticated-request';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateZoneDto } from './dto/create-zone.dto';
import { UpdateZoneStatusDto } from './dto/update-zone-status.dto';
import { UpdateZoneDto } from './dto/update-zone.dto';
import { Zone } from './schemas/zone.schema';
import { ZonesService } from './zones.service';

@Controller('zones')
export class ZonesController {
  constructor(
    private readonly zonesService: ZonesService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

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
  async create(
    @Body() dto: CreateZoneDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<Zone> {
    const zone = await this.zonesService.create(dto);
    const { _id } = zone as Zone & { _id: Types.ObjectId };
    await this.auditLogsService.log({
      userId: actor.id,
      action: 'ZONE_CREATED',
      entity: 'Zone',
      entityId: _id.toString(),
      after: zone,
    });
    return zone;
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
