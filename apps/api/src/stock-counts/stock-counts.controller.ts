import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ZoneScope } from '../common/decorators/zone-scope.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import type { RequestUser } from '../common/types/authenticated-request';
import { CreateStockCountDto } from './dto/create-stock-count.dto';
import { StockCount } from './schemas/stock-count.schema';
import { StockCountsService } from './stock-counts.service';

@Controller('stock-counts')
export class StockCountsController {
  constructor(private readonly stockCountsService: StockCountsService) {}

  @RequirePermission(PERMISSION_CODES.STOCK_COUNT_READ)
  @Get()
  findAll(@CurrentUser() user: RequestUser): Promise<StockCount[]> {
    return this.stockCountsService.findAll({
      zoneIds: user.isSuperScope ? undefined : user.zoneIds,
    });
  }

  @RequirePermission(PERMISSION_CODES.STOCK_COUNT_READ)
  @Get(':id')
  findById(@Param('id') id: string): Promise<StockCount> {
    return this.stockCountsService.findById(id);
  }

  @RequirePermission(PERMISSION_CODES.STOCK_COUNT_CREATE)
  @ZoneScope({ source: 'body', field: 'zoneId' })
  @Post()
  create(
    @Body() dto: CreateStockCountDto,
    @CurrentUser() user: RequestUser,
  ): Promise<StockCount> {
    return this.stockCountsService.create(dto, user.id);
  }

  @RequirePermission(PERMISSION_CODES.STOCK_COUNT_APPROVE)
  @ZoneScope({
    source: 'entity',
    field: 'zoneId',
    lookupService: StockCountsService,
  })
  @Patch(':id/approve')
  approve(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<StockCount> {
    return this.stockCountsService.approve(id, user.id);
  }
}
