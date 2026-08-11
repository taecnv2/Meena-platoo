import { Controller, Get } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import { DashboardService, DashboardSummary } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @RequirePermission(PERMISSION_CODES.DASHBOARD_READ)
  @Get('owner')
  getOwnerSummary(): Promise<DashboardSummary> {
    return this.dashboardService.getOwnerSummary();
  }
}
