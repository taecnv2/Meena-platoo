import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, QueryFilter, Types } from 'mongoose';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PERMISSION_CODES } from '../common/constants/permissions';
import type { RequestUser } from '../common/types/authenticated-request';
import { buildDateRangeQuery } from '../common/utils/date-range.util';
import {
  IngredientsService,
  ResolvedQuantity,
} from '../ingredients/ingredients.service';
import { InventoryService } from '../inventory/inventory.service';
import { CreateProductionDto } from './dto/create-production.dto';
import { allocateProductionCost } from './production-cost.util';
import {
  ProductionBatch,
  ProductionBatchDocument,
  ProductionLine,
} from './schemas/production-batch.schema';

export interface FindProductionFilter {
  zoneId?: string;
  zoneIds?: string[];
  ingredientId?: string;
  dateFrom?: string;
  dateTo?: string;
}

const MAX_CODE_RETRIES = 5;

type ProductionBatchWithId = ProductionBatch & { _id: Types.ObjectId };

@Injectable()
export class ProductionService {
  constructor(
    @InjectModel(ProductionBatch.name)
    private readonly batchModel: Model<ProductionBatchDocument>,
    private readonly ingredientsService: IngredientsService,
    private readonly inventoryService: InventoryService,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  findAll(filter: FindProductionFilter): Promise<ProductionBatch[]> {
    const query: QueryFilter<ProductionBatchDocument> = {};
    if (filter.zoneIds) {
      // A requested zone narrows the user's own zones; it never widens them.
      query.zoneId = {
        $in: filter.zoneId
          ? filter.zoneIds.filter((zoneId) => zoneId === filter.zoneId)
          : filter.zoneIds,
      };
    } else if (filter.zoneId) {
      query.zoneId = filter.zoneId;
    }
    if (filter.ingredientId) {
      query.$or = [
        { 'input.ingredientId': filter.ingredientId },
        { 'outputs.ingredientId': filter.ingredientId },
      ];
    }
    const createdAt = buildDateRangeQuery(filter.dateFrom, filter.dateTo);
    if (createdAt) {
      query.createdAt = createdAt;
    }
    return this.batchModel
      .find(query)
      .sort({ createdAt: -1 })
      .limit(300)
      .lean();
  }

  async findById(id: string): Promise<ProductionBatch> {
    const batch = await this.batchModel.findById(id).lean();
    if (!batch) {
      throw new NotFoundException('ไม่พบรายการแปรรูปนี้');
    }
    return batch;
  }

  async findZoneIdById(id: string, field: string): Promise<string> {
    if (field !== 'zoneId') {
      throw new BadRequestException(
        `ProductionBatch has no zone field "${field}"`,
      );
    }
    const batch = await this.batchModel.findById(id).select('zoneId').lean();
    if (!batch) {
      throw new NotFoundException('ไม่พบรายการแปรรูปนี้');
    }
    return batch.zoneId.toString();
  }

  async create(
    dto: CreateProductionDto,
    user: Pick<RequestUser, 'id' | 'permissions'>,
  ): Promise<ProductionBatch> {
    const userId = user.id;
    // Standard costs are master data: only users allowed to edit ingredients may overwrite them.
    if (
      dto.updateDefaultCost &&
      !user.permissions.includes(PERMISSION_CODES.INGREDIENTS_UPDATE)
    ) {
      throw new ForbiddenException(
        'ไม่มีสิทธิ์แก้ไขต้นทุนมาตรฐาน (ต้องมีสิทธิ์แก้ไขวัตถุดิบ)',
      );
    }
    if (
      dto.outputs.some(
        (output) => output.ingredientId === dto.inputIngredientId,
      )
    ) {
      throw new BadRequestException(
        'สินค้าที่ได้ต้องไม่ใช่วัตถุดิบตัวเดียวกับวัตถุดิบตั้งต้น',
      );
    }

    const input = await this.ingredientsService.resolveQuantity(
      dto.inputIngredientId,
      dto.inputQuantity,
      dto.inputUnitId,
    );
    const outputs = await Promise.all(
      dto.outputs.map((output) =>
        this.ingredientsService.resolveQuantity(
          output.ingredientId,
          output.quantity,
          output.unitId,
        ),
      ),
    );

    const inputUnitCost =
      dto.inputUnitCost !== undefined
        ? dto.inputUnitCost / input.factor
        : input.ingredient.defaultCost;
    const totalCost = round2(inputUnitCost * input.baseQuantity);
    const outputUnitCosts = allocateProductionCost(
      totalCost,
      outputs.map((output, index) => ({
        baseQuantity: output.baseQuantity,
        inputQuantity: output.inputQuantity,
        portionWeight: dto.outputs[index].portionWeight,
      })),
    );

    const inputLine = toLine(input, inputUnitCost, null);
    const outputLines = outputs.map((output, index) =>
      toLine(
        output,
        outputUnitCosts[index],
        dto.outputs[index].portionWeight ?? null,
      ),
    );

    const batch = await this.createWithRetries(async (code) =>
      this.inventoryService.withTransaction(async (session) => {
        const [doc] = await this.batchModel.create(
          [
            {
              code,
              zoneId: dto.zoneId,
              input: inputLine,
              outputs: outputLines,
              wasteQuantity: dto.wasteQuantity ?? null,
              yieldPercent: computeYield(input, outputs, dto),
              totalCost,
              performedBy: userId,
              remark: dto.remark?.trim() || null,
            },
          ],
          { session },
        );
        const referenceId = doc._id.toString();
        await this.inventoryService.decrement(
          {
            ingredientId: dto.inputIngredientId,
            zoneId: dto.zoneId,
            quantity: inputLine.quantity,
            unit: inputLine.unit,
            movementType: 'PRODUCTION_OUT',
            referenceType: 'PRODUCTION',
            referenceId,
            unitCost: inputLine.unitCost,
            performedBy: userId,
            inputQuantity: inputLine.inputQuantity,
            inputUnit: inputLine.inputUnit,
            remark: code,
          },
          session,
        );
        for (const line of outputLines) {
          await this.inventoryService.increment(
            {
              ingredientId: line.ingredientId.toString(),
              zoneId: dto.zoneId,
              quantity: line.quantity,
              unit: line.unit,
              movementType: 'PRODUCTION_IN',
              referenceType: 'PRODUCTION',
              referenceId,
              unitCost: line.unitCost,
              performedBy: userId,
              inputQuantity: line.inputQuantity,
              inputUnit: line.inputUnit,
              remark: code,
            },
            session,
          );
        }
        return doc.toObject();
      }),
    );

    if (dto.updateDefaultCost) {
      for (const line of outputLines) {
        await this.ingredientsService.update(line.ingredientId.toString(), {
          // Cost per base unit can be tiny (e.g. per gram), so keep 4 decimals.
          defaultCost: round4(line.unitCost),
        });
      }
    }
    await this.auditLogsService.log({
      userId,
      action: 'PRODUCTION_CREATED',
      entity: 'ProductionBatch',
      entityId: batch._id.toString(),
      after: {
        code: batch.code,
        zoneId: batch.zoneId,
        input: batch.input,
        outputs: batch.outputs,
        updateDefaultCost: !!dto.updateDefaultCost,
      },
    });
    return batch;
  }

  private async createWithRetries(
    create: (code: string) => Promise<ProductionBatchWithId>,
  ): Promise<ProductionBatchWithId> {
    for (let attempt = 0; attempt < MAX_CODE_RETRIES; attempt += 1) {
      try {
        return await create(await this.generateCode());
      } catch (error) {
        if (!isDuplicateKeyError(error)) {
          throw error;
        }
      }
    }
    throw new ConflictException(
      'ไม่สามารถสร้างเลขที่รายการแปรรูปได้ กรุณาลองใหม่',
    );
  }

  private async generateCode(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.batchModel.countDocuments({
      code: new RegExp(`^PRD-${year}-`),
    });
    return `PRD-${year}-${String(count + 1).padStart(4, '0')}`;
  }
}

function toLine(
  resolved: ResolvedQuantity,
  unitCost: number,
  portionWeight: number | null,
): ProductionLine {
  return {
    ingredientId: resolved.ingredient._id,
    quantity: resolved.baseQuantity,
    unit: resolved.baseUnit,
    inputQuantity: resolved.inputQuantity,
    inputUnit: resolved.inputUnit,
    portionWeight,
    unitCost,
    totalCost: round2(unitCost * resolved.baseQuantity),
  };
}

/** Output weight / input weight, only when the raw ingredient is weighed and every output has a portion weight. */
function computeYield(
  input: ResolvedQuantity,
  outputs: ResolvedQuantity[],
  dto: CreateProductionDto,
): number | null {
  const baseUnit = input.ingredient.baseUnitId;
  if (baseUnit.type !== 'WEIGHT' || !(baseUnit.conversionFactor > 0)) {
    return null;
  }
  if (!dto.outputs.every((output) => output.portionWeight)) {
    return null;
  }
  const inputKg = input.baseQuantity * baseUnit.conversionFactor;
  const outputKg = outputs.reduce(
    (sum, output, index) =>
      sum +
      (output.inputQuantity * (dto.outputs[index].portionWeight ?? 0)) / 1000,
    0,
  );
  return inputKg > 0 ? round2((outputKg / inputKg) * 100) : null;
}

function round4(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: number }).code === 11000
  );
}
