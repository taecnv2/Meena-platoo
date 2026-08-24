import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import type { RequestUser } from '../common/types/authenticated-request';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';
import { Role } from './schemas/role.schema';

@Controller('roles')
export class RolesController {
  constructor(
    private readonly rolesService: RolesService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

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
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateRoleDto,
    @CurrentUser() actor: RequestUser,
  ): Promise<Role> {
    const before = await this.rolesService.findById(id);
    const after = await this.rolesService.update(id, dto);
    await this.auditLogsService.log({
      userId: actor.id,
      action: dto.permissions ? 'PERMISSION_CHANGED' : 'ROLE_CHANGED',
      entity: 'Role',
      entityId: id,
      before,
      after,
    });
    return after;
  }
}
