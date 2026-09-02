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
import type { Types } from 'mongoose';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { ZoneScope } from '../common/decorators/zone-scope.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import type { RequestUser } from '../common/types/authenticated-request';
import { ExportService, type ExportFormat } from '../export/export.service';
import { IngredientsService } from '../ingredients/ingredients.service';
import { Ingredient } from '../ingredients/schemas/ingredient.schema';
import { ZonesService } from '../zones/zones.service';
import { Zone } from '../zones/schemas/zone.schema';
import { CreateStockCountDto } from './dto/create-stock-count.dto';
import { buildStockCountExportColumns } from './stock-count-export.columns';
import { StockCount } from './schemas/stock-count.schema';
import { StockCountsService } from './stock-counts.service';

/** `findAll()` return types drop `_id` from their declared signature even though `.lean()`
 * results always carry it -- see the same pattern in reports.service.ts. */
type WithId<T> = T & { _id: Types.ObjectId };

@Controller('stock-counts')
export class StockCountsController {
  constructor(
    private readonly stockCountsService: StockCountsService,
    private readonly ingredientsService: IngredientsService,
    private readonly zonesService: ZonesService,
    private readonly exportService: ExportService,
  ) {}

  @RequirePermission(PERMISSION_CODES.STOCK_COUNT_READ)
  @Get()
  findAll(@CurrentUser() user: RequestUser): Promise<StockCount[]> {
    return this.stockCountsService.findAll({
      zoneIds: user.isSuperScope ? undefined : user.zoneIds,
    });
  }

  @RequirePermission(PERMISSION_CODES.STOCK_COUNT_EXPORT)
  @Get('export')
  async export(
    @Query('format') format: ExportFormat,
    @CurrentUser() user: RequestUser,
  ): Promise<StreamableFile> {
    const [rows, zones, ingredients] = await Promise.all([
      this.stockCountsService.findAll({
        zoneIds: user.isSuperScope ? undefined : user.zoneIds,
        limit: 100000,
      }),
      this.zonesService.findAll(),
      this.ingredientsService.findAll(),
    ]);
    const zoneMap = new Map(
      (zones as Array<WithId<Zone>>).map((z) => [z._id.toString(), z.name]),
    );
    const ingredientMap = new Map(
      (ingredients as Array<WithId<Ingredient>>).map((i) => [
        i._id.toString(),
        i.name,
      ]),
    );
    const buffer = await this.exportService.toFile(
      format,
      rows as Array<StockCount & { createdAt: Date }>,
      buildStockCountExportColumns(zoneMap, ingredientMap),
      {
        title: 'การตรวจนับสต๊อก',
        generatedAt: new Date(),
        generatedBy: user.username,
      },
    );
    return this.exportService.streamableFile(buffer, 'stock-counts', format);
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
