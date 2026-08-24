import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { InventoryModule } from '../inventory/inventory.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Waste, WasteSchema } from './schemas/waste.schema';
import { WasteController } from './waste.controller';
import { WasteService } from './waste.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Waste.name, schema: WasteSchema }]),
    IngredientsModule,
    InventoryModule,
    AuditLogsModule,
    NotificationsModule,
  ],
  controllers: [WasteController],
  providers: [WasteService],
  exports: [WasteService],
})
export class WasteModule {}
