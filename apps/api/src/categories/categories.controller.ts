import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category } from './schemas/category.schema';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @RequirePermission(PERMISSION_CODES.CATEGORIES_READ)
  @Get()
  findAll(): Promise<Category[]> {
    return this.categoriesService.findAll();
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
