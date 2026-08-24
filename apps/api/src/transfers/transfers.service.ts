import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, QueryFilter, Model } from 'mongoose';
import { buildDateRangeQuery } from '../common/utils/date-range.util';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { IngredientsService } from '../ingredients/ingredients.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { Transfer, TransferDocument } from './schemas/transfer.schema';

export interface ExecuteTransferInput {
  fromZoneId: string;
  toZoneId: string;
  items: Array<{ ingredientId: string; quantity: number }>;
  requisitionId: string | null;
  performedBy: string;
}

export interface FindTransfersFilter {
  zoneIds?: string[];
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
}

@Injectable()
export class TransfersService {
  constructor(
    @InjectModel(Transfer.name)
    private readonly transferModel: Model<TransferDocument>,
    private readonly inventoryService: InventoryService,
    private readonly ingredientsService: IngredientsService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  findAll(filter: FindTransfersFilter): Promise<Transfer[]> {
    const query: QueryFilter<TransferDocument> = {};
    if (filter.zoneIds) {
      query.$or = [
        { fromZoneId: { $in: filter.zoneIds } },
        { toZoneId: { $in: filter.zoneIds } },
      ];
    }
    const createdAt = buildDateRangeQuery(filter.dateFrom, filter.dateTo);
    if (createdAt) {
      query.createdAt = createdAt;
    }
    return this.transferModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(filter.limit ?? 200)
      .lean();
  }

  async findById(id: string): Promise<Transfer> {
    const transfer = await this.transferModel.findById(id).lean();
    if (!transfer) {
      throw new NotFoundException('ไม่พบการโอนสินค้านี้');
    }
    return transfer;
  }

  async findZoneIdById(id: string, field: string): Promise<string> {
    const transfer = await this.transferModel.findById(id).select(field).lean();
    if (!transfer) {
      throw new NotFoundException('ไม่พบการโอนสินค้านี้');
    }
    const zoneId =
      field === 'toZoneId' ? transfer.toZoneId : transfer.fromZoneId;
    return zoneId.toString();
  }

  createDirectTransfer(
    dto: CreateTransferDto,
    userId: string,
  ): Promise<Transfer> {
    return this.executeTransfer({
      fromZoneId: dto.fromZoneId,
      toZoneId: dto.toZoneId,
      items: dto.items,
      requisitionId: null,
      performedBy: userId,
    });
  }

  /** Creates + completes a transfer atomically. Called directly, and internally by RequisitionsService.fulfill(). */
  async executeTransfer(input: ExecuteTransferInput): Promise<Transfer> {
    const resolvedItems = await Promise.all(
      input.items.map(async (item) => {
        const ingredient = await this.ingredientsService.findByIdWithUnit(
          item.ingredientId,
        );
        return {
          ingredientId: item.ingredientId,
          quantity: item.quantity,
          unit: ingredient.baseUnitId.code,
          unitCost: ingredient.defaultCost,
        };
      }),
    );

    return this.inventoryService
      .withTransaction(async (session: ClientSession) => {
        const [transferDoc] = await this.transferModel.create(
          [
            {
              fromZoneId: input.fromZoneId,
              toZoneId: input.toZoneId,
              status: 'PENDING',
              items: resolvedItems.map(({ ingredientId, quantity, unit }) => ({
                ingredientId,
                quantity,
                unit,
              })),
              requisitionId: input.requisitionId,
              performedBy: input.performedBy,
              completedAt: null,
            },
          ],
          { session },
        );
        const referenceId = transferDoc._id.toString();

        for (const item of resolvedItems) {
          await this.inventoryService.decrement(
            {
              ingredientId: item.ingredientId,
              zoneId: input.fromZoneId,
              quantity: item.quantity,
              unit: item.unit,
              movementType: 'TRANSFER_OUT',
              referenceType: 'TRANSFER',
              referenceId,
              unitCost: item.unitCost,
              performedBy: input.performedBy,
            },
            session,
          );
          await this.inventoryService.increment(
            {
              ingredientId: item.ingredientId,
              zoneId: input.toZoneId,
              quantity: item.quantity,
              unit: item.unit,
              movementType: 'TRANSFER_IN',
              referenceType: 'TRANSFER',
              referenceId,
              unitCost: item.unitCost,
              performedBy: input.performedBy,
            },
            session,
          );
        }

        transferDoc.status = 'COMPLETED';
        transferDoc.completedAt = new Date();
        await transferDoc.save({ session });

        return transferDoc.toObject();
      })
      .then(async (transfer) => {
        await this.auditLogsService.log({
          userId: input.performedBy,
          action: 'TRANSFER_COMPLETED',
          entity: 'Transfer',
          entityId: transfer._id.toString(),
          after: {
            fromZoneId: transfer.fromZoneId,
            toZoneId: transfer.toZoneId,
            items: transfer.items,
          },
        });
        return transfer;
      });
  }
}
