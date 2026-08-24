import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ZoneScope } from '../common/decorators/zone-scope.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import type { RequestUser } from '../common/types/authenticated-request';
import { CreateWasteDto } from './dto/create-waste.dto';
import { RejectWasteDto } from './dto/reject-waste.dto';
import { WASTE_STATUSES, Waste, WasteStatus } from './schemas/waste.schema';
import { WasteService } from './waste.service';

@Controller('waste')
export class WasteController {
  constructor(private readonly wasteService: WasteService) {}

  @RequirePermission(PERMISSION_CODES.WASTE_READ)
  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
    @Query('ingredientId') ingredientId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<Waste[]> {
    const resolvedStatus = (WASTE_STATUSES as readonly string[]).includes(
      status ?? '',
    )
      ? (status as WasteStatus)
      : undefined;
    return this.wasteService.findAll({
      zoneIds: user.isSuperScope ? undefined : user.zoneIds,
      status: resolvedStatus,
      ingredientId,
      dateFrom,
      dateTo,
    });
  }

  @RequirePermission(PERMISSION_CODES.WASTE_READ)
  @Get(':id')
  findById(@Param('id') id: string): Promise<Waste> {
    return this.wasteService.findById(id);
  }

  @RequirePermission(PERMISSION_CODES.WASTE_CREATE)
  @ZoneScope({ source: 'body', field: 'zoneId' })
  @Post()
  create(
    @Body() dto: CreateWasteDto,
    @CurrentUser() user: RequestUser,
  ): Promise<Waste> {
    return this.wasteService.create(dto, user.id);
  }

  @RequirePermission(PERMISSION_CODES.WASTE_APPROVE)
  @ZoneScope({ source: 'entity', field: 'zoneId', lookupService: WasteService })
  @Patch(':id/approve')
  approve(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<Waste> {
    return this.wasteService.approve(id, user.id);
  }

  @RequirePermission(PERMISSION_CODES.WASTE_APPROVE)
  @ZoneScope({ source: 'entity', field: 'zoneId', lookupService: WasteService })
  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectWasteDto,
    @CurrentUser() user: RequestUser,
  ): Promise<Waste> {
    return this.wasteService.reject(id, dto, user.id);
  }
}
