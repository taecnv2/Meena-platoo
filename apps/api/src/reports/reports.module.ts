import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Ingredient,
  IngredientSchema,
} from '../ingredients/schemas/ingredient.schema';
import {
  PurchaseOrder,
  PurchaseOrderSchema,
} from '../purchasing/schemas/purchase-order.schema';
import {
  Requisition,
  RequisitionSchema,
} from '../requisitions/schemas/requisition.schema';
import {
  StockMovement,
  StockMovementSchema,
} from '../stock-movements/schemas/stock-movement.schema';
import { Supplier, SupplierSchema } from '../suppliers/schemas/supplier.schema';
import {
  ZoneStock,
  ZoneStockSchema,
} from '../inventory/schemas/zone-stock.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Waste, WasteSchema } from '../waste/schemas/waste.schema';
import { Zone, ZoneSchema } from '../zones/schemas/zone.schema';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ZoneStock.name, schema: ZoneStockSchema },
      { name: Ingredient.name, schema: IngredientSchema },
      { name: Zone.name, schema: ZoneSchema },
      { name: Requisition.name, schema: RequisitionSchema },
      { name: StockMovement.name, schema: StockMovementSchema },
      { name: User.name, schema: UserSchema },
      { name: PurchaseOrder.name, schema: PurchaseOrderSchema },
      { name: Supplier.name, schema: SupplierSchema },
      { name: Waste.name, schema: WasteSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
