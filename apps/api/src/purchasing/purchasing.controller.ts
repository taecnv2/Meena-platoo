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
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import type { RequestUser } from '../common/types/authenticated-request';
import { CreatePurchaseOrderDto } from './dto/create-purchase-order.dto';
import { ReceivePurchaseOrderDto } from './dto/receive-purchase-order.dto';
import { RejectPurchaseOrderDto } from './dto/reject-purchase-order.dto';
import { PurchasingService } from './purchasing.service';
import {
  PURCHASE_ORDER_STATUSES,
  PurchaseOrder,
  PurchaseOrderStatus,
} from './schemas/purchase-order.schema';

@Controller('purchasing')
export class PurchasingController {
  constructor(private readonly purchasingService: PurchasingService) {}

  @RequirePermission(PERMISSION_CODES.PURCHASING_READ)
  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('supplierId') supplierId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<PurchaseOrder[]> {
    const resolvedStatus = (
      PURCHASE_ORDER_STATUSES as readonly string[]
    ).includes(status ?? '')
      ? (status as PurchaseOrderStatus)
      : undefined;
    return this.purchasingService.findAll({
      status: resolvedStatus,
      supplierId,
      dateFrom,
      dateTo,
    });
  }

  @RequirePermission(PERMISSION_CODES.PURCHASING_READ)
  @Get(':id')
  findById(@Param('id') id: string): Promise<PurchaseOrder> {
    return this.purchasingService.findById(id);
  }

  @RequirePermission(PERMISSION_CODES.PURCHASING_CREATE)
  @Post()
  create(
    @Body() dto: CreatePurchaseOrderDto,
    @CurrentUser() user: RequestUser,
  ): Promise<PurchaseOrder> {
    return this.purchasingService.create(dto, user.id);
  }

  @RequirePermission(PERMISSION_CODES.PURCHASING_CREATE)
  @Patch(':id/submit')
  submit(@Param('id') id: string): Promise<PurchaseOrder> {
    return this.purchasingService.submit(id);
  }

  @RequirePermission(PERMISSION_CODES.PURCHASING_APPROVE)
  @Patch(':id/approve')
  approve(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<PurchaseOrder> {
    return this.purchasingService.approve(id, user.id);
  }

  @RequirePermission(PERMISSION_CODES.PURCHASING_APPROVE)
  @Patch(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectPurchaseOrderDto,
    @CurrentUser() user: RequestUser,
  ): Promise<PurchaseOrder> {
    return this.purchasingService.reject(id, dto, user.id);
  }

  @RequirePermission(PERMISSION_CODES.PURCHASING_RECEIVE)
  @Patch(':id/receive')
  receive(
    @Param('id') id: string,
    @Body() dto: ReceivePurchaseOrderDto,
    @CurrentUser() user: RequestUser,
  ): Promise<PurchaseOrder> {
    return this.purchasingService.receive(id, dto, user.id);
  }

  @RequirePermission(PERMISSION_CODES.PURCHASING_CREATE)
  @Patch(':id/cancel')
  cancel(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ): Promise<PurchaseOrder> {
    return this.purchasingService.cancel(id, user.id);
  }
}
