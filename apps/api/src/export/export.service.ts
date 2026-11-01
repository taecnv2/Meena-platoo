import { Injectable, StreamableFile } from '@nestjs/common';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuditAction } from '../audit-logs/schemas/audit-log.schema';
import { buildCsv } from './csv.util';
import type { ExportColumn, ExportMeta } from './export-column.interface';
import { buildPdf } from './pdf.util';

export type ExportFormat = 'csv' | 'pdf';

export interface AuditExportInput {
  userId: string;
  entity: string;
  action: AuditAction;
}

@Injectable()
export class ExportService {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  async toFile<T>(
    format: ExportFormat,
    rows: T[],
    columns: Array<ExportColumn<T>>,
    meta: ExportMeta,
  ): Promise<Buffer> {
    return format === 'pdf'
      ? buildPdf(rows, columns, meta)
      : buildCsv(rows, columns);
  }

  streamableFile(
    buffer: Buffer,
    resourceSlug: string,
    format: ExportFormat,
  ): StreamableFile {
    const filename = buildExportFilename(resourceSlug, format);
    return new StreamableFile(buffer, {
      type: format === 'pdf' ? 'application/pdf' : 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${filename}"`,
    });
  }

  /** Best-effort audit trail for exports of sensitive data (users/roles/permissions/audit). */
  async logExport(
    input: AuditExportInput,
    format: ExportFormat,
  ): Promise<void> {
    await this.auditLogsService.log({
      userId: input.userId,
      action: input.action,
      entity: input.entity,
      entityId: null,
      remark: `Exported as ${format.toUpperCase()}`,
    });
  }
}

export function buildExportFilename(
  resourceSlug: string,
  format: ExportFormat,
): string {
  const isoDate = new Date().toISOString().slice(0, 10);
  return `${resourceSlug}_${isoDate}.${format}`;
}
