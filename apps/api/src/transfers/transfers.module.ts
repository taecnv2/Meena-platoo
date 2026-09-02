import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { InventoryModule } from '../inventory/inventory.module';
import { ZonesModule } from '../zones/zones.module';
import { Transfer, TransferSchema } from './schemas/transfer.schema';
import { TransfersController } from './transfers.controller';
import { TransfersService } from './transfers.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transfer.name, schema: TransferSchema },
    ]),
    IngredientsModule,
    InventoryModule,
    ZonesModule,
    AuditLogsModule,
  ],
  controllers: [TransfersController],
  providers: [TransfersService],
  exports: [TransfersService],
})
export class TransfersModule {}
