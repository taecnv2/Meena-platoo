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
import { ApproveRequisitionDto } from './dto/approve-requisition.dto';
import { CreateRequisitionDto } from './dto/create-requisition.dto';
import { FulfillRequisitionDto } from './dto/fulfill-requisition.dto';
import { RejectRequisitionDto } from './dto/reject-requisition.dto';
import { RequisitionsService } from './requisitions.service';
import {
  REQUISITION_STATUSES,
  Requisition,
  RequisitionStatus,
} from './schemas/requisition.schema';

@Controller('requisitions')
export class RequisitionsController {
  constructor(private readonly requisitionsService: RequisitionsService) {}

  @RequirePermission(PERMISSION_CODES.REQUISITION_READ)
  @Get()
  findAll(
    @CurrentUser() user: RequestUser,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<Requisition[]> {
    const resolvedStatus = (REQUISITION_STATUSES as readonly string[]).includes(
      status ?? '',
    )
      ? (status as RequisitionStatus)
      : undefined;
    return this.requisitionsService.findAll({
      zoneIds: user.isSuperScope ? undefined : user.zoneIds,
      status: resolvedStatus,
      dateFrom,
      dateTo,
    });
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
