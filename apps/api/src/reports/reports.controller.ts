import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import {
  COMPARISON_PERIOD_TYPES,
  ComparisonPeriodType,
  ReportsService,
} from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @RequirePermission(PERMISSION_CODES.REPORTS_READ)
  @Get('zone')
  getZoneReport(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('zoneId') zoneId?: string,
  ) {
    return this.reportsService.getZoneReport(dateFrom, dateTo, zoneId);
  }

  @RequirePermission(PERMISSION_CODES.REPORTS_READ)
  @Get('requisition')
  getRequisitionReport(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('zoneId') zoneId?: string,
  ) {
    return this.reportsService.getRequisitionReport(dateFrom, dateTo, zoneId);
  }

  @RequirePermission(PERMISSION_CODES.REPORTS_READ)
  @Get('comparison')
  getComparisonReport(
    @Query('periodType') periodType: string = 'THIS_MONTH_VS_LAST_MONTH',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    if (!(COMPARISON_PERIOD_TYPES as readonly string[]).includes(periodType)) {
      throw new BadRequestException('periodType ไม่ถูกต้อง');
    }
    return this.reportsService.getComparisonReport(
      periodType as ComparisonPeriodType,
      dateFrom,
      dateTo,
    );
  }
}
