import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { StockMovementsModule } from '../stock-movements/stock-movements.module';
import { ZonesModule } from '../zones/zones.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { ZoneStock, ZoneStockSchema } from './schemas/zone-stock.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ZoneStock.name, schema: ZoneStockSchema },
    ]),
    IngredientsModule,
    StockMovementsModule,
    ZonesModule,
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
