import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { QueryFilter, Model } from 'mongoose';
import { buildDateRangeQuery } from '../common/utils/date-range.util';
import {
  AuditAction,
  AuditLog,
  AuditLogDocument,
} from './schemas/audit-log.schema';

export interface RecordAuditLogInput {
  userId: string;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  remark?: string | null;
}

export interface FindAuditLogsFilter {
  userId?: string;
  entity?: string;
  action?: AuditAction;
  dateFrom?: string;
  dateTo?: string;
}

@Injectable()
export class AuditLogsService {
  private readonly logger = new Logger(AuditLogsService.name);

  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
  ) {}

  /**
   * Best-effort write: audit logging must never fail or roll back the business
   * operation it's recording, so failures are swallowed and logged instead of thrown.
   */
  async log(input: RecordAuditLogInput): Promise<void> {
    try {
      await this.auditLogModel.create({
        userId: input.userId,
        action: input.action,
        entity: input.entity,
        entityId: input.entityId ?? null,
        before: input.before ?? null,
        after: input.after ?? null,
        remark: input.remark ?? null,
      });
    } catch (error) {
      this.logger.error(
        `Failed to record audit log for action ${input.action} on ${input.entity}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  findAll(filter: FindAuditLogsFilter): Promise<AuditLog[]> {
    const query: QueryFilter<AuditLogDocument> = {};
    if (filter.userId) {
      query.userId = filter.userId;
    }
    if (filter.entity) {
      query.entity = filter.entity;
    }
    if (filter.action) {
      query.action = filter.action;
    }
    const createdAt = buildDateRangeQuery(filter.dateFrom, filter.dateTo);
    if (createdAt) {
      query.createdAt = createdAt;
    }
    return this.auditLogModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();
  }
}
