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
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { ExportService, type ExportFormat } from '../export/export.service';
import { PermissionsService } from '../permissions/permissions.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { buildRoleExportColumns } from './role-export.columns';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RolesService } from './roles.service';
import { Role } from './schemas/role.schema';

@Controller('roles')
export class RolesController {
  constructor(
    private readonly rolesService: RolesService,
    private readonly auditLogsService: AuditLogsService,
    private readonly permissionsService: PermissionsService,
    private readonly exportService: ExportService,
  ) {}

  @RequirePermission(PERMISSION_CODES.ROLES_READ)
  @Get()
  findAll(): Promise<Role[]> {
    return this.rolesService.findAll();
  }

  @RequirePermission(PERMISSION_CODES.ROLES_EXPORT)
  @Get('export')
  async export(
    @Query('format') format: ExportFormat,
    @CurrentUser() user: RequestUser,
  ): Promise<StreamableFile> {
    const [rows, permissions] = await Promise.all([
      this.rolesService.findAll(),
      this.permissionsService.findAll(),
    ]);
    const permissionNameMap = new Map(permissions.map((p) => [p.code, p.name]));
    const buffer = await this.exportService.toFile(
      format,
      rows,
      buildRoleExportColumns(permissionNameMap),
      {
        title: 'รายชื่อบทบาท',
        generatedAt: new Date(),
        generatedBy: user.username,
      },
    );
    await this.exportService.logExport(
      { userId: user.id, entity: 'Role', action: 'DATA_EXPORTED' },
      format,
    );
    return this.exportService.streamableFile(buffer, 'roles', format);
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
