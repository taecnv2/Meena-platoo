import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import { AuditLogsService } from './audit-logs.service';
import {
  AUDIT_ACTIONS,
  AuditAction,
  AuditLog,
} from './schemas/audit-log.schema';

@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @RequirePermission(PERMISSION_CODES.AUDIT_READ)
  @Get()
  findAll(
    @Query('userId') userId?: string,
    @Query('entity') entity?: string,
    @Query('action') action?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<AuditLog[]> {
    const resolvedAction = (AUDIT_ACTIONS as readonly string[]).includes(
      action ?? '',
    )
      ? (action as AuditAction)
      : undefined;
    return this.auditLogsService.findAll({
      userId,
      entity,
      action: resolvedAction,
      dateFrom,
      dateTo,
    });
  }
}
