import { Controller, Get, Query } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import { DashboardService, DashboardSummary } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @RequirePermission(PERMISSION_CODES.DASHBOARD_READ)
  @Get('owner')
  getOwnerSummary(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<DashboardSummary> {
    return this.dashboardService.getOwnerSummary(dateFrom, dateTo);
  }
}
