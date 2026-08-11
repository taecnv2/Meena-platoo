import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { IngredientsModule } from '../ingredients/ingredients.module';
import { TransfersModule } from '../transfers/transfers.module';
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
  ],
  controllers: [RequisitionsController],
  providers: [RequisitionsService],
  exports: [RequisitionsService],
})
export class RequisitionsModule {}
