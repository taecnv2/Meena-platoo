import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { Unit, UnitSchema } from '../units/schemas/unit.schema';
import { CategoriesModule } from '../categories/categories.module';
import { UnitsModule } from '../units/units.module';
import { Ingredient, IngredientSchema } from './schemas/ingredient.schema';
import { IngredientsController } from './ingredients.controller';
import { IngredientsService } from './ingredients.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Ingredient.name, schema: IngredientSchema },
      { name: Unit.name, schema: UnitSchema },
    ]),
    AuditLogsModule,
    CategoriesModule,
    UnitsModule,
  ],
  controllers: [IngredientsController],
  providers: [IngredientsService],
  exports: [IngredientsService],
})
export class IngredientsModule {}
