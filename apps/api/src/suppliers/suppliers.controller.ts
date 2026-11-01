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
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { Supplier } from './schemas/supplier.schema';
import { SUPPLIER_EXPORT_COLUMNS } from './supplier-export.columns';
import { SuppliersService } from './suppliers.service';

@Controller('suppliers')
export class SuppliersController {
  constructor(
    private readonly suppliersService: SuppliersService,
    private readonly exportService: ExportService,
  ) {}

  @RequirePermission(PERMISSION_CODES.SUPPLIERS_READ)
  @Get()
  findAll(): Promise<Supplier[]> {
    return this.suppliersService.findAll();
  }

  @RequirePermission(PERMISSION_CODES.SUPPLIERS_EXPORT)
  @Get('export')
  async export(
    @Query('format') format: ExportFormat,
    @CurrentUser() user: RequestUser,
  ): Promise<StreamableFile> {
    const rows = await this.suppliersService.findAll();
    const buffer = await this.exportService.toFile(
      format,
      rows,
      SUPPLIER_EXPORT_COLUMNS,
      {
        title: 'รายชื่อ Supplier',
        generatedAt: new Date(),
        generatedBy: user.username,
      },
    );
    return this.exportService.streamableFile(buffer, 'suppliers', format);
  }

  @RequirePermission(PERMISSION_CODES.SUPPLIERS_READ)
  @Get(':id')
  findById(@Param('id') id: string): Promise<Supplier> {
    return this.suppliersService.findById(id);
  }

  @RequirePermission(PERMISSION_CODES.SUPPLIERS_CREATE)
  @Post()
  create(@Body() dto: CreateSupplierDto): Promise<Supplier> {
    return this.suppliersService.create(dto);
  }

  @RequirePermission(PERMISSION_CODES.SUPPLIERS_UPDATE)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSupplierDto,
  ): Promise<Supplier> {
    return this.suppliersService.update(id, dto);
  }
}
