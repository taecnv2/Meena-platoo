import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { Supplier } from './schemas/supplier.schema';
import { SuppliersService } from './suppliers.service';

@Controller('suppliers')
export class SuppliersController {
  constructor(private readonly suppliersService: SuppliersService) {}

  @RequirePermission(PERMISSION_CODES.SUPPLIERS_READ)
  @Get()
  findAll(): Promise<Supplier[]> {
    return this.suppliersService.findAll();
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
