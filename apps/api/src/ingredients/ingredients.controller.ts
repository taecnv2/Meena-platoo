import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { IngredientsService } from './ingredients.service';
import { Ingredient } from './schemas/ingredient.schema';

@Controller('ingredients')
export class IngredientsController {
  constructor(private readonly ingredientsService: IngredientsService) {}

  @RequirePermission(PERMISSION_CODES.INGREDIENTS_READ)
  @Get()
  findAll(): Promise<Ingredient[]> {
    return this.ingredientsService.findAll();
  }

  @RequirePermission(PERMISSION_CODES.INGREDIENTS_READ)
  @Get(':id')
  findById(@Param('id') id: string): Promise<Ingredient> {
    return this.ingredientsService.findById(id);
  }

  @RequirePermission(PERMISSION_CODES.INGREDIENTS_CREATE)
  @Post()
  create(@Body() dto: CreateIngredientDto): Promise<Ingredient> {
    return this.ingredientsService.create(dto);
  }

  @RequirePermission(PERMISSION_CODES.INGREDIENTS_UPDATE)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateIngredientDto,
  ): Promise<Ingredient> {
    return this.ingredientsService.update(id, dto);
  }
}
