import {
  Body,
  Controller,
  Get,
  Param,
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
import { CreateTransferDto } from './dto/create-transfer.dto';
import { buildTransferExportColumns } from './transfer-export.columns';
import { Transfer } from './schemas/transfer.schema';
import { TransfersService } from './transfers.service';

/** `findAll()` return types drop `_id` from their declared signature even though `.lean()`
 * results always carry it -- see the same pattern in reports.service.ts. */
type WithId<T> = T & { _id: Types.ObjectId };

@Controller('transfers')
export class TransfersController {
  constructor(
    private readonly transfersService: TransfersService,
    private readonly ingredientsService: IngredientsService,
    private readonly zonesService: ZonesService,
    private readonly exportService: ExportService,
  ) {}

  @RequirePermission(PERMISSION_CODES.TRANSFER_READ)
  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<Transfer[]> {
    return this.transfersService.findAll({
      zoneIds: user.isSuperScope ? undefined : user.zoneIds,
      dateFrom,
      dateTo,
    });
  }

  @RequirePermission(PERMISSION_CODES.TRANSFER_EXPORT)
  @Get('export')
  async export(
    @Query('format') format: ExportFormat,
    @CurrentUser() user: RequestUser,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<StreamableFile> {
    const [rows, zones, ingredients] = await Promise.all([
      this.transfersService.findAll({
        zoneIds: user.isSuperScope ? undefined : user.zoneIds,
        dateFrom,
        dateTo,
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
      rows as Array<Transfer & { createdAt: Date }>,
      buildTransferExportColumns(zoneMap, ingredientMap),
      {
        title: 'การโอนสินค้า',
        generatedAt: new Date(),
        generatedBy: user.username,
      },
    );
    return this.exportService.streamableFile(buffer, 'transfers', format);
  }

  @RequirePermission(PERMISSION_CODES.TRANSFER_READ)
  @Get(':id')
  findById(@Param('id') id: string): Promise<Transfer> {
    return this.transfersService.findById(id);
  }

  @RequirePermission(PERMISSION_CODES.TRANSFER_CREATE)
  @ZoneScope({ source: 'body', field: 'fromZoneId' })
  @Post()
  create(
    @Body() dto: CreateTransferDto,
    @CurrentUser() user: RequestUser,
  ): Promise<Transfer> {
    return this.transfersService.createDirectTransfer(dto, user.id);
  }
}
