import {
  BadRequestException,
  Controller,
  Get,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { RequirePermission } from '../common/decorators/require-permission.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PERMISSION_CODES } from '../common/constants/permissions';
import type { RequestUser } from '../common/types/authenticated-request';
import { ExportService, type ExportFormat } from '../export/export.service';
import { formatExportCurrency } from '../export/format.util';
import {
  COMPARISON_REPORT_EXPORT_COLUMNS,
  COST_REPORT_EXPORT_COLUMNS,
  INVENTORY_REPORT_EXPORT_COLUMNS,
  PURCHASE_REPORT_EXPORT_COLUMNS,
  REQUISITION_REPORT_EXPORT_COLUMNS,
  WASTE_REPORT_EXPORT_COLUMNS,
  ZONE_REPORT_EXPORT_COLUMNS,
} from './report-export.columns';
import {
  COMPARISON_PERIOD_TYPES,
  ComparisonPeriodType,
  ReportsService,
} from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly exportService: ExportService,
  ) {}

  @RequirePermission(PERMISSION_CODES.REPORTS_READ)
  @Get('inventory')
  getInventoryReport(
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('zoneId') zoneId?: string,
  ) {
    return this.reportsService.getInventoryReport(dateFrom, dateTo, zoneId);
  }

  @RequirePermission(PERMISSION_CODES.REPORTS_EXPORT)
  @Get('inventory/export')
  async exportInventoryReport(
    @Query('format') format: ExportFormat,
    @CurrentUser() user: RequestUser,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('zoneId') zoneId?: string,
  ): Promise<StreamableFile> {
    const rows = await this.reportsService.getInventoryReport(
      dateFrom,
      dateTo,
      zoneId,
    );
    const buffer = await this.exportService.toFile(
      format,
      rows,
      INVENTORY_REPORT_EXPORT_COLUMNS,
      {
        title: 'รายงานสต๊อก',
        generatedAt: new Date(),
        generatedBy: user.username,
      },
    );
    return this.exportService.streamableFile(
      buffer,
      'report-inventory',
      format,
    );
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

  @RequirePermission(PERMISSION_CODES.REPORTS_EXPORT)
  @Get('purchase/export')
  async exportPurchaseReport(
    @Query('format') format: ExportFormat,
    @CurrentUser() user: RequestUser,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('supplierId') supplierId?: string,
  ): Promise<StreamableFile> {
    const report = await this.reportsService.getPurchaseReport(
      dateFrom,
      dateTo,
      supplierId,
    );
    const buffer = await this.exportService.toFile(
      format,
      report.byIngredient,
      PURCHASE_REPORT_EXPORT_COLUMNS,
      {
        title: 'รายงานการจัดซื้อ (แยกตามวัตถุดิบ)',
        generatedAt: new Date(),
        generatedBy: user.username,
        filters: {
          จำนวนใบสั่งซื้อ: String(report.totals.numberOfOrders),
          มูลค่าสั่งซื้อรวม: formatExportCurrency(
            report.totals.totalOrderedValue,
          ),
          มูลค่ารับสินค้ารวม: formatExportCurrency(
            report.totals.totalReceivedValue,
          ),
        },
      },
    );
    return this.exportService.streamableFile(buffer, 'report-purchase', format);
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

  @RequirePermission(PERMISSION_CODES.REPORTS_EXPORT)
  @Get('waste/export')
  async exportWasteReport(
    @Query('format') format: ExportFormat,
    @CurrentUser() user: RequestUser,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('zoneId') zoneId?: string,
  ): Promise<StreamableFile> {
    const report = await this.reportsService.getWasteReport(
      dateFrom,
      dateTo,
      zoneId,
    );
    const buffer = await this.exportService.toFile(
      format,
      report.byIngredient,
      WASTE_REPORT_EXPORT_COLUMNS,
      {
        title: 'รายงานของเสีย (แยกตามวัตถุดิบ)',
        generatedAt: new Date(),
        generatedBy: user.username,
        filters: {
          จำนวนรายการ: String(report.totals.numberOfRecords),
          มูลค่ารวม: formatExportCurrency(report.totals.totalValue),
          รออนุมัติ: String(report.totals.pendingCount),
        },
      },
    );
    return this.exportService.streamableFile(buffer, 'report-waste', format);
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

  @RequirePermission(PERMISSION_CODES.REPORTS_EXPORT)
  @Get('cost/export')
  async exportCostReport(
    @Query('format') format: ExportFormat,
    @CurrentUser() user: RequestUser,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('zoneId') zoneId?: string,
  ): Promise<StreamableFile> {
    const report = await this.reportsService.getCostReport(
      dateFrom,
      dateTo,
      zoneId,
    );
    const buffer = await this.exportService.toFile(
      format,
      report.byIngredient,
      COST_REPORT_EXPORT_COLUMNS,
      {
        title: 'รายงานต้นทุน (แยกตามวัตถุดิบ)',
        generatedAt: new Date(),
        generatedBy: user.username,
        filters: { ต้นทุนรวม: formatExportCurrency(report.totalCost) },
      },
    );
    return this.exportService.streamableFile(buffer, 'report-cost', format);
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

  @RequirePermission(PERMISSION_CODES.REPORTS_EXPORT)
  @Get('zone/export')
  async exportZoneReport(
    @Query('format') format: ExportFormat,
    @CurrentUser() user: RequestUser,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('zoneId') zoneId?: string,
  ): Promise<StreamableFile> {
    const rows = await this.reportsService.getZoneReport(
      dateFrom,
      dateTo,
      zoneId,
    );
    const buffer = await this.exportService.toFile(
      format,
      rows,
      ZONE_REPORT_EXPORT_COLUMNS,
      {
        title: 'รายงานตาม Zone',
        generatedAt: new Date(),
        generatedBy: user.username,
      },
    );
    return this.exportService.streamableFile(buffer, 'report-zone', format);
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

  @RequirePermission(PERMISSION_CODES.REPORTS_EXPORT)
  @Get('requisition/export')
  async exportRequisitionReport(
    @Query('format') format: ExportFormat,
    @CurrentUser() user: RequestUser,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('zoneId') zoneId?: string,
  ): Promise<StreamableFile> {
    const report = await this.reportsService.getRequisitionReport(
      dateFrom,
      dateTo,
      zoneId,
    );
    const buffer = await this.exportService.toFile(
      format,
      report.topRequestedIngredients,
      REQUISITION_REPORT_EXPORT_COLUMNS,
      {
        title: 'รายงานใบเบิกสินค้า (10 วัตถุดิบยอดนิยม)',
        generatedAt: new Date(),
        generatedBy: user.username,
        filters: {
          จำนวนใบเบิก: String(report.numberOfRequests),
          มูลค่ารวม: formatExportCurrency(report.totalRequestedValue),
        },
      },
    );
    return this.exportService.streamableFile(
      buffer,
      'report-requisition',
      format,
    );
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

  @RequirePermission(PERMISSION_CODES.REPORTS_EXPORT)
  @Get('comparison/export')
  async exportComparisonReport(
    @Query('format') format: ExportFormat,
    @CurrentUser() user: RequestUser,
    @Query('periodType') periodType: string = 'THIS_MONTH_VS_LAST_MONTH',
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ): Promise<StreamableFile> {
    if (!(COMPARISON_PERIOD_TYPES as readonly string[]).includes(periodType)) {
      throw new BadRequestException('periodType ไม่ถูกต้อง');
    }
    const report = await this.reportsService.getComparisonReport(
      periodType as ComparisonPeriodType,
      dateFrom,
      dateTo,
    );
    const buffer = await this.exportService.toFile(
      format,
      report.metrics,
      COMPARISON_REPORT_EXPORT_COLUMNS,
      {
        title: 'รายงานเปรียบเทียบ',
        generatedAt: new Date(),
        generatedBy: user.username,
      },
    );
    return this.exportService.streamableFile(
      buffer,
      'report-comparison',
      format,
    );
  }
}
