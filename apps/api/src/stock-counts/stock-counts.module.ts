import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ZonesModule } from '../zones/zones.module';
import { StockCount, StockCountSchema } from './schemas/stock-count.schema';
import { StockCountsController } from './stock-counts.controller';
import { StockCountsService } from './stock-counts.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: StockCount.name, schema: StockCountSchema },
    ]),
    IngredientsModule,
    InventoryModule,
    ZonesModule,
  ],
  controllers: [StockCountsController],
  providers: [StockCountsService],
  exports: [StockCountsService],
})
export class StockCountsModule {}
