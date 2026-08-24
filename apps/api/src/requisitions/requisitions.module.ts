import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { TransfersModule } from '../transfers/transfers.module';
import { ZonesModule } from '../zones/zones.module';
import { Requisition, RequisitionSchema } from './schemas/requisition.schema';
import { RequisitionsController } from './requisitions.controller';
import { RequisitionsService } from './requisitions.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Requisition.name, schema: RequisitionSchema },
    ]),
    IngredientsModule,
    TransfersModule,
    ZonesModule,
    AuditLogsModule,
    NotificationsModule,
  ],
  controllers: [RequisitionsController],
  providers: [RequisitionsService],
  exports: [RequisitionsService],
})
export class RequisitionsModule {}
