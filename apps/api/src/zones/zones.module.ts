import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Zone, ZoneSchema } from './schemas/zone.schema';
import { ZonesController } from './zones.controller';
import { ZonesService } from './zones.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Zone.name, schema: ZoneSchema }]),
  ],
  controllers: [ZonesController],
  providers: [ZonesService],
  exports: [ZonesService],
})
export class ZonesModule {}
