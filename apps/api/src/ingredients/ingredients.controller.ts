import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import type { RequestUser } from '../common/types/authenticated-request';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { IngredientsService } from './ingredients.service';
import { Ingredient } from './schemas/ingredient.schema';

@Controller('ingredients')
export class IngredientsController {
  constructor(
    private readonly ingredientsService: IngredientsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

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
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateIngredientDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<Ingredient> {
    const before = await this.ingredientsService.findById(id);
    const after = await this.ingredientsService.update(id, dto);
    await this.auditLogsService.log({
      userId: actor.id,
      action: 'INGREDIENT_UPDATED',
      entity: 'Ingredient',
      entityId: id,
      before,
      after,
    });
    return after;
  }
}
