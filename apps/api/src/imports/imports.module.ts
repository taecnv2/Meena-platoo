import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import {
  Category,
  CategorySchema,
} from '../categories/schemas/category.schema';
import { IngredientsModule } from '../ingredients/ingredients.module';
import {
  Ingredient,
  IngredientSchema,
} from '../ingredients/schemas/ingredient.schema';
import { InventoryModule } from '../inventory/inventory.module';
import {
  ZoneStock,
  ZoneStockSchema,
} from '../inventory/schemas/zone-stock.schema';
import { Unit, UnitSchema } from '../units/schemas/unit.schema';
import { Zone, ZoneSchema } from '../zones/schemas/zone.schema';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Ingredient.name, schema: IngredientSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Unit.name, schema: UnitSchema },
      { name: Zone.name, schema: ZoneSchema },
      { name: ZoneStock.name, schema: ZoneStockSchema },
    ]),
    IngredientsModule,
    InventoryModule,
    AuditLogsModule,
  ],
  controllers: [ImportsController],
  providers: [ImportsService],
})
export class ImportsModule {}
