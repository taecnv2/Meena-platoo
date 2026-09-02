import { Controller, Get, Query, StreamableFile } from '@nestjs/common';
import type { Types } from 'mongoose';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import type { RequestUser } from '../common/types/authenticated-request';
import { ExportService, type ExportFormat } from '../export/export.service';
import { IngredientsService } from '../ingredients/ingredients.service';
import { Ingredient } from '../ingredients/schemas/ingredient.schema';
import { ZonesService } from '../zones/zones.service';
import { Zone } from '../zones/schemas/zone.schema';
import { buildStockMovementExportColumns } from './stock-movement-export.columns';
import { StockMovementsService } from './stock-movements.service';
import {
  MOVEMENT_TYPES,
  MovementType,
  StockMovement,
} from './schemas/stock-movement.schema';

/** `findAll()` return types drop `_id` from their declared signature even though `.lean()`
 * results always carry it -- see the same pattern in reports.service.ts. */
type WithId<T> = T & { _id: Types.ObjectId };

@Controller('stock-movements')
export class StockMovementsController {
  constructor(
    private readonly stockMovementsService: StockMovementsService,
    private readonly ingredientsService: IngredientsService,
    private readonly zonesService: ZonesService,
    private readonly exportService: ExportService,
  ) {}

  @RequirePermission(PERMISSION_CODES.INVENTORY_READ)
  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query('ingredientId') ingredientId?: string,
    @Query('zoneId') zoneId?: string,
    @Query('movementType') movementType?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<StockMovement[]> {
    return this.stockMovementsService.findAll({
      ingredientId,
      zoneId,
      zoneIds: user.isSuperScope ? undefined : user.zoneIds,
      movementType: resolveMovementType(movementType),
      dateFrom,
      dateTo,
    });
  }

  @RequirePermission(PERMISSION_CODES.INVENTORY_EXPORT)
  @Get('export')
  async export(
    @Query('format') format: ExportFormat,
    @CurrentUser() user: RequestUser,
    @Query('ingredientId') ingredientId?: string,
    @Query('zoneId') zoneId?: string,
    @Query('movementType') movementType?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<StreamableFile> {
    const [rows, ingredients, zones] = await Promise.all([
      this.stockMovementsService.findAll({
        ingredientId,
        zoneId,
        zoneIds: user.isSuperScope ? undefined : user.zoneIds,
        movementType: resolveMovementType(movementType),
        dateFrom,
        dateTo,
      }),
      this.ingredientsService.findAll(),
      this.zonesService.findAll(),
    ]);
    const ingredientMap = new Map(
      (ingredients as Array<WithId<Ingredient>>).map((i) => [
        i._id.toString(),
        i.name,
      ]),
    );
    const zoneMap = new Map(
      (zones as Array<WithId<Zone>>).map((z) => [z._id.toString(), z.name]),
    );
    const columns = buildStockMovementExportColumns(ingredientMap, zoneMap);
    const buffer = await this.exportService.toFile(
      format,
      rows as Array<StockMovement & { createdAt: Date }>,
      columns,
      {
        title: 'ประวัติการเคลื่อนไหวสต๊อก',
        generatedAt: new Date(),
        generatedBy: user.username,
        filters: buildFilterSummary(ingredientMap, zoneMap, {
          ingredientId,
          zoneId,
          movementType,
          dateFrom,
          dateTo,
        }),
      },
    );
    return this.exportService.streamableFile(buffer, 'stock-movements', format);
  }
}

function resolveMovementType(movementType?: string): MovementType | undefined {
  return (MOVEMENT_TYPES as readonly string[]).includes(movementType ?? '')
    ? (movementType as MovementType)
    : undefined;
}

function buildFilterSummary(
  ingredientMap: Map<string, string>,
  zoneMap: Map<string, string>,
  filters: {
    ingredientId?: string;
    zoneId?: string;
    movementType?: string;
    dateFrom?: string;
    dateTo?: string;
  },
): Record<string, string> | undefined {
  const summary: Record<string, string> = {};
  if (filters.ingredientId) {
    summary['วัตถุดิบ'] =
      ingredientMap.get(filters.ingredientId) ?? filters.ingredientId;
  }
  if (filters.zoneId) {
    summary['Zone'] = zoneMap.get(filters.zoneId) ?? filters.zoneId;
  }
  if (filters.movementType) {
    summary['ประเภท'] = filters.movementType;
  }
  if (filters.dateFrom || filters.dateTo) {
    summary['ช่วงวันที่'] =
      `${filters.dateFrom ?? '...'} - ${filters.dateTo ?? '...'}`;
  }
  return Object.keys(summary).length > 0 ? summary : undefined;
}
