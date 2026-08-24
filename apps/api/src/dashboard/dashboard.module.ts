import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Ingredient,
  IngredientSchema,
} from '../ingredients/schemas/ingredient.schema';
import {
  Requisition,
  RequisitionSchema,
} from '../requisitions/schemas/requisition.schema';
import {
  ZoneStock,
  ZoneStockSchema,
} from '../inventory/schemas/zone-stock.schema';
import { Transfer, TransferSchema } from '../transfers/schemas/transfer.schema';
import {
  StockCount,
  StockCountSchema,
} from '../stock-counts/schemas/stock-count.schema';
import {
  StockMovement,
  StockMovementSchema,
} from '../stock-movements/schemas/stock-movement.schema';
import { Waste, WasteSchema } from '../waste/schemas/waste.schema';
import {
  PurchaseOrder,
  PurchaseOrderSchema,
} from '../purchasing/schemas/purchase-order.schema';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ZoneStock.name, schema: ZoneStockSchema },
      { name: Ingredient.name, schema: IngredientSchema },
      { name: Requisition.name, schema: RequisitionSchema },
      { name: Transfer.name, schema: TransferSchema },
      { name: StockCount.name, schema: StockCountSchema },
      { name: StockMovement.name, schema: StockMovementSchema },
      { name: Waste.name, schema: WasteSchema },
      { name: PurchaseOrder.name, schema: PurchaseOrderSchema },
    ]),
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
