import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import { OperationalReportsService } from './operational-reports.service';
import {
  COMPARISON_PERIOD_TYPES,
  ComparisonPeriodType,
  ReportsService,
} from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly operationalReportsService: OperationalReportsService,
  ) {}

  /** Spreadsheet-style daily ledger: opening / in / out / closing per ingredient per day. */
  @RequirePermission(PERMISSION_CODES.REPORTS_READ)
  @Get('ledger')
  getLedger(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('zoneId') zoneId?: string,
    @Query('categoryId') categoryId?: string,
  ) {
    return this.operationalReportsService.getLedger({
      dateFrom,
      dateTo,
      zoneId: zoneId || undefined,
      categoryId: categoryId || undefined,
    });
  }

  /** Supplier billing statement (ใบวางบิล): every delivery received from one supplier in a period. */
  @RequirePermission(PERMISSION_CODES.REPORTS_READ)
  @Get('supplier-statement')
  getSupplierStatement(
    @Query('supplierId') supplierId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.operationalReportsService.getSupplierStatement({
      supplierId,
      dateFrom,
      dateTo,
    });
  }

  /** Consignment stock (ฝากขาย) received / sold / remaining per owner. */
  @RequirePermission(PERMISSION_CODES.REPORTS_READ)
  @Get('consignment')
  getConsignmentReport(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('owner') owner?: string,
  ) {
    return this.operationalReportsService.getConsignmentReport({
      dateFrom,
      dateTo,
      owner,
    });
  }

  @RequirePermission(PERMISSION_CODES.REPORTS_READ)
  @Get('inventory')
  getInventoryReport(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('zoneId') zoneId?: string,
  ) {
    return this.reportsService.getInventoryReport(dateFrom, dateTo, zoneId);
  }

  @RequirePermission(PERMISSION_CODES.REPORTS_READ)
  @Get('purchase')
  getPurchaseReport(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('supplierId') supplierId?: string,
  ) {
    return this.reportsService.getPurchaseReport(dateFrom, dateTo, supplierId);
  }

  @RequirePermission(PERMISSION_CODES.REPORTS_READ)
  @Get('waste')
  getWasteReport(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('zoneId') zoneId?: string,
  ) {
    return this.reportsService.getWasteReport(dateFrom, dateTo, zoneId);
  }

  @RequirePermission(PERMISSION_CODES.REPORTS_READ)
  @Get('cost')
  getCostReport(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('zoneId') zoneId?: string,
  ) {
    return this.reportsService.getCostReport(dateFrom, dateTo, zoneId);
  }

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
