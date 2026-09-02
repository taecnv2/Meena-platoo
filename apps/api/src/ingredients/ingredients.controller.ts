import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  StreamableFile,
} from '@nestjs/common';
import type { Types } from 'mongoose';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import type { RequestUser } from '../common/types/authenticated-request';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CategoriesService } from '../categories/categories.service';
import { Category } from '../categories/schemas/category.schema';
import { UnitsService } from '../units/units.service';
import { Unit } from '../units/schemas/unit.schema';
import { ExportService, type ExportFormat } from '../export/export.service';
import { CreateIngredientDto } from './dto/create-ingredient.dto';
import { UpdateIngredientDto } from './dto/update-ingredient.dto';
import { buildIngredientExportColumns } from './ingredient-export.columns';
import { IngredientsService } from './ingredients.service';
import { Ingredient } from './schemas/ingredient.schema';

/** `findAll()` return types drop `_id` from their declared signature even though `.lean()`
 * results always carry it -- see the same pattern in reports.service.ts. */
type WithId<T> = T & { _id: Types.ObjectId };

@Controller('ingredients')
export class IngredientsController {
  constructor(
    private readonly ingredientsService: IngredientsService,
    private readonly auditLogsService: AuditLogsService,
    private readonly categoriesService: CategoriesService,
    private readonly unitsService: UnitsService,
    private readonly exportService: ExportService,
  ) {}

  @RequirePermission(PERMISSION_CODES.INGREDIENTS_READ)
  @Get()
  findAll(): Promise<Ingredient[]> {
    return this.ingredientsService.findAll();
  }

  @RequirePermission(PERMISSION_CODES.INGREDIENTS_EXPORT)
  @Get('export')
  async export(
    @Query('format') format: ExportFormat,
    @CurrentUser() user: RequestUser,
  ): Promise<StreamableFile> {
    const [rows, categories, units] = await Promise.all([
      this.ingredientsService.findAll(),
      this.categoriesService.findAll(),
      this.unitsService.findAll(),
    ]);
    const categoryMap = new Map(
      (categories as Array<WithId<Category>>).map((c) => [
        c._id.toString(),
        c.name,
      ]),
    );
    const unitMap = new Map(
      (units as Array<WithId<Unit>>).map((u) => [u._id.toString(), u.name]),
    );
    const columns = buildIngredientExportColumns(categoryMap, unitMap);
    const buffer = await this.exportService.toFile(format, rows, columns, {
      title: 'รายชื่อวัตถุดิบ',
      generatedAt: new Date(),
      generatedBy: user.username,
    });
    return this.exportService.streamableFile(buffer, 'ingredients', format);
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
