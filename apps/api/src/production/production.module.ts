import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ProductionController } from './production.controller';
import { ProductionService } from './production.service';
import {
  ProductionBatch,
  ProductionBatchSchema,
} from './schemas/production-batch.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ProductionBatch.name, schema: ProductionBatchSchema },
    ]),
    IngredientsModule,
    InventoryModule,
    AuditLogsModule,
  ],
  controllers: [ProductionController],
  providers: [ProductionService],
})
export class ProductionModule {}
