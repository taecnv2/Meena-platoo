import { Controller, Get, Query, StreamableFile } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import type { RequestUser } from '../common/types/authenticated-request';
import { ExportService, type ExportFormat } from '../export/export.service';
import { PERMISSION_EXPORT_COLUMNS } from './permission-export.columns';
import { PermissionsService } from './permissions.service';
import { Permission } from './schemas/permission.schema';

@Controller('permissions')
export class PermissionsController {
  constructor(
    private readonly permissionsService: PermissionsService,
    private readonly exportService: ExportService,
  ) {}

  @RequirePermission(PERMISSION_CODES.PERMISSIONS_READ)
  @Get()
  findAll(): Promise<Permission[]> {
    return this.permissionsService.findAll();
  }

  @RequirePermission(PERMISSION_CODES.PERMISSIONS_EXPORT)
  @Get('export')
  async export(
    @Query('format') format: ExportFormat,
    @CurrentUser() user: RequestUser,
  ): Promise<StreamableFile> {
    const rows = await this.permissionsService.findAll();
    const buffer = await this.exportService.toFile(
      format,
      rows,
      PERMISSION_EXPORT_COLUMNS,
      {
        title: 'รายชื่อสิทธิ์การใช้งาน',
        generatedAt: new Date(),
        generatedBy: user.username,
      },
    );
    await this.exportService.logExport(
      { userId: user.id, entity: 'Permission', action: 'DATA_EXPORTED' },
      format,
    );
    return this.exportService.streamableFile(buffer, 'permissions', format);
  }
}
