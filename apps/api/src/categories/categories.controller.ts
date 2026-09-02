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
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import type { RequestUser } from '../common/types/authenticated-request';
import { ExportService, type ExportFormat } from '../export/export.service';
import { CategoriesService } from './categories.service';
import { CATEGORY_EXPORT_COLUMNS } from './category-export.columns';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './schemas/category.schema';

@Controller('categories')
export class CategoriesController {
  constructor(
    private readonly categoriesService: CategoriesService,
    private readonly exportService: ExportService,
  ) {}

  @RequirePermission(PERMISSION_CODES.CATEGORIES_READ)
  @Get()
  findAll(): Promise<Category[]> {
    return this.categoriesService.findAll();
  }

  @RequirePermission(PERMISSION_CODES.CATEGORIES_EXPORT)
  @Get('export')
  async export(
    @Query('format') format: ExportFormat,
    @CurrentUser() user: RequestUser,
  ): Promise<StreamableFile> {
    const rows = await this.categoriesService.findAll();
    const buffer = await this.exportService.toFile(
      format,
      rows,
      CATEGORY_EXPORT_COLUMNS,
      {
        title: 'รายชื่อหมวดหมู่',
        generatedAt: new Date(),
        generatedBy: user.username,
      },
    );
    return this.exportService.streamableFile(buffer, 'categories', format);
  }

  @RequirePermission(PERMISSION_CODES.CATEGORIES_READ)
  @Get(':id')
  findById(@Param('id') id: string): Promise<Category> {
    return this.categoriesService.findById(id);
  }

  @RequirePermission(PERMISSION_CODES.CATEGORIES_CREATE)
  @Post()
  create(@Body() dto: CreateCategoryDto): Promise<Category> {
    return this.categoriesService.create(dto);
  }

  @RequirePermission(PERMISSION_CODES.CATEGORIES_UPDATE)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<Category> {
    return this.categoriesService.update(id, dto);
  }
}
