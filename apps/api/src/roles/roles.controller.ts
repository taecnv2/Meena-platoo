import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';
import { Role } from './schemas/role.schema';

@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @RequirePermission(PERMISSION_CODES.ROLES_READ)
  @Get()
  findAll(): Promise<Role[]> {
    return this.rolesService.findAll();
  }

  @RequirePermission(PERMISSION_CODES.ROLES_READ)
  @Get(':id')
  findById(@Param('id') id: string): Promise<Role> {
    return this.rolesService.findById(id);
  }

  @RequirePermission(PERMISSION_CODES.ROLES_CREATE)
  @Post()
  create(@Body() dto: CreateRoleDto): Promise<Role> {
    return this.rolesService.create(dto);
  }

  @RequirePermission(PERMISSION_CODES.ROLES_UPDATE)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto): Promise<Role> {
    return this.rolesService.update(id, dto);
  }
}
