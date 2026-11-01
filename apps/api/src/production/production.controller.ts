import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PERMISSION_CODES } from '../common/constants/permissions';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ZoneScope } from '../common/decorators/zone-scope.decorator';
import type { RequestUser } from '../common/types/authenticated-request';
import { CreateProductionDto } from './dto/create-production.dto';
import { ProductionService } from './production.service';
import { ProductionBatch } from './schemas/production-batch.schema';

@Controller('production')
export class ProductionController {
  constructor(private readonly productionService: ProductionService) {}

  @RequirePermission(PERMISSION_CODES.PRODUCTION_READ)
  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query('zoneId') zoneId?: string,
    @Query('ingredientId') ingredientId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<ProductionBatch[]> {
    return this.productionService.findAll({
      zoneId,
      zoneIds: user.isSuperScope ? undefined : user.zoneIds,
      ingredientId,
      dateFrom,
      dateTo,
    });
  }

  @RequirePermission(PERMISSION_CODES.PRODUCTION_READ)
  @ZoneScope({
    source: 'entity',
    field: 'zoneId',
    lookupService: ProductionService,
  })
  @Get(':id')
  findById(@Param('id') id: string): Promise<ProductionBatch> {
    return this.productionService.findById(id);
  }

  @RequirePermission(PERMISSION_CODES.PRODUCTION_CREATE)
  @ZoneScope({ source: 'body', field: 'zoneId' })
  @Post()
  create(
    @Body() dto: CreateProductionDto,
    @CurrentUser() user: RequestUser,
  ): Promise<ProductionBatch> {
    return this.productionService.create(dto, user);
  }
}
