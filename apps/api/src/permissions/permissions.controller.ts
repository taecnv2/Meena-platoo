import { Controller, Get } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import { PermissionsService } from './permissions.service';
import { Permission } from './schemas/permission.schema';

@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @RequirePermission(PERMISSION_CODES.PERMISSIONS_READ)
  @Get()
  findAll(): Promise<Permission[]> {
    return this.permissionsService.findAll();
  }
}
