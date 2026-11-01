import { Global, Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { ExportService } from './export.service';

@Global()
@Module({
  imports: [AuditLogsModule],
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}
