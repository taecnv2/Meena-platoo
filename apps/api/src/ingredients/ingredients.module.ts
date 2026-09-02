import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CategoriesModule } from '../categories/categories.module';
import { UnitsModule } from '../units/units.module';
import { Ingredient, IngredientSchema } from './schemas/ingredient.schema';
import { IngredientsController } from './ingredients.controller';
import { IngredientsService } from './ingredients.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Ingredient.name, schema: IngredientSchema },
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
