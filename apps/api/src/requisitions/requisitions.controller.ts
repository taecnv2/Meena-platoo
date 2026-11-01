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
import { ZonesService } from '../zones/zones.service';
import { Zone } from '../zones/schemas/zone.schema';
import { ApproveRequisitionDto } from './dto/approve-requisition.dto';
import { CreateRequisitionDto } from './dto/create-requisition.dto';
import { FulfillRequisitionDto } from './dto/fulfill-requisition.dto';
import { RejectRequisitionDto } from './dto/reject-requisition.dto';
import { buildRequisitionExportColumns } from './requisition-export.columns';
import { RequisitionsService } from './requisitions.service';
import {
  REQUISITION_STATUSES,
  Requisition,
  RequisitionStatus,
} from './schemas/requisition.schema';

/** `findAll()` return types drop `_id` from their declared signature even though `.lean()`
 * results always carry it -- see the same pattern in reports.service.ts. */
type WithId<T> = T & { _id: Types.ObjectId };

function resolveStatus(status?: string): RequisitionStatus | undefined {
  return (REQUISITION_STATUSES as readonly string[]).includes(status ?? '')
    ? (status as RequisitionStatus)
    : undefined;
}

@Controller('requisitions')
export class RequisitionsController {
  constructor(
    private readonly requisitionsService: RequisitionsService,
    private readonly zonesService: ZonesService,
    private readonly exportService: ExportService,
  ) {}

  @RequirePermission(PERMISSION_CODES.REQUISITION_READ)
  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<Requisition[]> {
    return this.requisitionsService.findAll({
      zoneIds: user.isSuperScope ? undefined : user.zoneIds,
      status: resolveStatus(status),
      dateFrom,
      dateTo,
    });
  }

  @RequirePermission(PERMISSION_CODES.REQUISITION_EXPORT)
  @Get('export')
  async export(
    @Query('format') format: ExportFormat,
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<StreamableFile> {
    const [rows, zones] = await Promise.all([
      this.requisitionsService.findAll({
        zoneIds: user.isSuperScope ? undefined : user.zoneIds,
        status: resolveStatus(status),
        dateFrom,
        dateTo,
        limit: 100000,
      }),
      this.zonesService.findAll(),
    ]);
    const zoneMap = new Map(
      (zones as Array<WithId<Zone>>).map((z) => [z._id.toString(), z.name]),
    );
    const buffer = await this.exportService.toFile(
      format,
      rows as Array<Requisition & { createdAt: Date }>,
      buildRequisitionExportColumns(zoneMap),
      {
        title: 'ใบเบิกสินค้า',
        generatedAt: new Date(),
        generatedBy: user.username,
      },
    );
    return this.exportService.streamableFile(buffer, 'requisitions', format);
  }

  @RequirePermission(PERMISSION_CODES.REQUISITION_READ)
  @Get(':id')
  findById(@Param('id') id: string): Promise<Requisition> {
    return this.requisitionsService.findById(id);
  }

  @RequirePermission(PERMISSION_CODES.REQUISITION_CREATE)
  @ZoneScope({ source: 'body', field: 'toZoneId' })
  @Post()
  create(
    @Body() dto: CreateRequisitionDto,
    @CurrentUser() user: RequestUser,
  ): Promise<Requisition> {
    return this.requisitionsService.create(dto, user.id);
  }

  @RequirePermission(PERMISSION_CODES.REQUISITION_APPROVE)
  @ZoneScope({
    source: 'entity',
    field: 'toZoneId',
    lookupService: RequisitionsService,
  })
  @Patch(':id/approve')
  approve(
    @Param('id') id: string,
    @Body() dto: ApproveRequisitionDto,
    @CurrentUser() user: RequestUser,
  ): Promise<Requisition> {
    return this.requisitionsService.approve(id, dto, user.id);
  }

  @RequirePermission(PERMISSION_CODES.REQUISITION_REJECT)
  @ZoneScope({
    source: 'entity',
    field: 'toZoneId',
    lookupService: RequisitionsService,
  })
  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectRequisitionDto,
    @CurrentUser() user: RequestUser,
  ): Promise<Requisition> {
    return this.requisitionsService.reject(id, dto, user.id);
  }

  @RequirePermission(PERMISSION_CODES.REQUISITION_FULFILL)
  @ZoneScope({
    source: 'entity',
    field: 'fromZoneId',
    lookupService: RequisitionsService,
  })
  @Patch(':id/fulfill')
  fulfill(
    @Param('id') id: string,
    @Body() dto: FulfillRequisitionDto,
    @CurrentUser() user: RequestUser,
  ): Promise<Requisition> {
    return this.requisitionsService.fulfill(id, dto, user.id);
  }

  @RequirePermission(PERMISSION_CODES.REQUISITION_CANCEL)
  @ZoneScope({
    source: 'entity',
    field: 'toZoneId',
    lookupService: RequisitionsService,
  })
  @Patch(':id/cancel')
  cancel(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<Requisition> {
    return this.requisitionsService.cancel(id, user.id);
  }
}
