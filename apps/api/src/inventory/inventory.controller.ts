import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import type { Types } from 'mongoose';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ZoneScope } from '../common/decorators/zone-scope.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import type { RequestUser } from '../common/types/authenticated-request';
import { ExportService, type ExportFormat } from '../export/export.service';
import { IngredientsService } from '../ingredients/ingredients.service';
import { Ingredient } from '../ingredients/schemas/ingredient.schema';
import { UnitsService } from '../units/units.service';
import { Unit } from '../units/schemas/unit.schema';
import { ZonesService } from '../zones/zones.service';
import { Zone } from '../zones/schemas/zone.schema';
import { StockMovement } from '../stock-movements/schemas/stock-movement.schema';
import { AdjustmentDto } from './dto/adjustment.dto';
import { StockInDto } from './dto/stock-in.dto';
import { StockOutDto } from './dto/stock-out.dto';
import { InventoryService } from './inventory.service';
import { ZoneStock } from './schemas/zone-stock.schema';
import { buildZoneStockExportColumns } from './zone-stock-export.columns';

/** `findAll()` return types drop `_id` from their declared signature even though `.lean()`
 * results always carry it -- see the same pattern in reports.service.ts. */
type WithId<T> = T & { _id: Types.ObjectId };

@Controller('inventory')
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly ingredientsService: IngredientsService,
    private readonly zonesService: ZonesService,
    private readonly unitsService: UnitsService,
    private readonly exportService: ExportService,
  ) {}

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

  @RequirePermission(PERMISSION_CODES.INVENTORY_EXPORT)
  @Get('balances/export')
  async exportBalances(
    @Query('format') format: ExportFormat,
    @CurrentUser() user: RequestUser,
    @Query('zoneId') zoneId?: string,
    @Query('ingredientId') ingredientId?: string,
  ): Promise<StreamableFile> {
    const [rows, ingredients, zones, units] = await Promise.all([
      this.inventoryService.findBalances({
        zoneId,
        ingredientId,
        zoneIds: user.isSuperScope ? undefined : user.zoneIds,
      }),
      this.ingredientsService.findAll(),
      this.zonesService.findAll(),
      this.unitsService.findAll(),
    ]);
    const ingredientMap = new Map(
      (ingredients as Array<WithId<Ingredient>>).map((i) => [
        i._id.toString(),
        i,
      ]),
    );
    const zoneMap = new Map(
      (zones as Array<WithId<Zone>>).map((z) => [z._id.toString(), z.name]),
    );
    const unitMap = new Map(
      (units as Array<WithId<Unit>>).map((u) => [u._id.toString(), u.name]),
    );
    const buffer = await this.exportService.toFile(
      format,
      rows,
      buildZoneStockExportColumns(ingredientMap, zoneMap, unitMap),
      {
        title: 'สต๊อกคงเหลือ',
        generatedAt: new Date(),
        generatedBy: user.username,
      },
    );
    return this.exportService.streamableFile(
      buffer,
      'inventory-balances',
      format,
    );
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
