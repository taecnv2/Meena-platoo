import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ZoneScope } from '../common/decorators/zone-scope.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import type { RequestUser } from '../common/types/authenticated-request';
import { StockMovement } from '../stock-movements/schemas/stock-movement.schema';
import { AdjustmentDto } from './dto/adjustment.dto';
import { StockInDto } from './dto/stock-in.dto';
import { StockOutDto } from './dto/stock-out.dto';
import { InventoryService } from './inventory.service';
import { ZoneStock } from './schemas/zone-stock.schema';

@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @RequirePermission(PERMISSION_CODES.INVENTORY_READ)
  @Get('balances')
  findBalances(
    @CurrentUser() user: RequestUser,
    @Query('zoneId') zoneId?: string,
    @Query('ingredientId') ingredientId?: string,
  ): Promise<ZoneStock[]> {
    return this.inventoryService.findBalances({
      zoneId,
      ingredientId,
      zoneIds: user.isSuperScope ? undefined : user.zoneIds,
    });
  }

  @RequirePermission(PERMISSION_CODES.INVENTORY_CREATE)
  @ZoneScope({ source: 'body', field: 'zoneId' })
  @Post('stock-in')
  stockIn(
    @Body() dto: StockInDto,
    @CurrentUser() user: RequestUser,
  ): Promise<StockMovement> {
    return this.inventoryService.stockIn(dto, user.id);
  }

  @RequirePermission(PERMISSION_CODES.INVENTORY_CREATE)
  @ZoneScope({ source: 'body', field: 'zoneId' })
  @Post('stock-out')
  stockOut(
    @Body() dto: StockOutDto,
    @CurrentUser() user: RequestUser,
  ): Promise<StockMovement> {
    return this.inventoryService.stockOut(dto, user.id);
  }

  @RequirePermission(PERMISSION_CODES.INVENTORY_ADJUST)
  @ZoneScope({ source: 'body', field: 'zoneId' })
  @Post('adjust')
  adjust(
    @Body() dto: AdjustmentDto,
    @CurrentUser() user: RequestUser,
  ): Promise<StockMovement> {
    return this.inventoryService.adjust(dto, user.id);
  }
}
