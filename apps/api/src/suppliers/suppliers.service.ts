import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  PurchaseOrder,
  PurchaseOrderDocument,
} from '../purchasing/schemas/purchase-order.schema';
import {
  StockMovement,
  StockMovementDocument,
} from '../stock-movements/schemas/stock-movement.schema';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';
import { Supplier, SupplierDocument } from './schemas/supplier.schema';

@Injectable()
export class SuppliersService {
  constructor(
    @InjectModel(Supplier.name)
    private readonly supplierModel: Model<SupplierDocument>,
    @InjectModel(PurchaseOrder.name)
    private readonly purchaseOrderModel: Model<PurchaseOrderDocument>,
    @InjectModel(StockMovement.name)
    private readonly stockMovementModel: Model<StockMovementDocument>,
  ) {}

  findAll(): Promise<Supplier[]> {
    return this.supplierModel.find().sort({ name: 1 }).lean();
  }

  async findById(id: string): Promise<Supplier> {
    const supplier = await this.supplierModel.findById(id).lean();
    if (!supplier) {
      throw new NotFoundException('ไม่พบ Supplier นี้');
    }
    return supplier;
  }

  async create(dto: CreateSupplierDto): Promise<Supplier> {
    const existing = await this.supplierModel
      .findOne({ code: dto.code.toUpperCase() })
      .lean();
    if (existing) {
      throw new ConflictException('มีรหัส Supplier นี้อยู่แล้ว');
    }
    const created = await this.supplierModel.create({
      ...dto,
      code: dto.code.toUpperCase(),
    });
    return created.toObject();
  }

  async update(id: string, dto: UpdateSupplierDto): Promise<Supplier> {
    const updated = await this.supplierModel
      .findByIdAndUpdate(id, dto, { returnDocument: 'after' })
      .lean();
    if (!updated) {
      throw new NotFoundException('ไม่พบ Supplier นี้');
    }
    return updated;
  }

  /**
   * Hard-deletes a supplier that nothing references. A supplier on any purchase order or
   * stock-in movement must stay, because supplier statements and purchase reports read those
   * records by supplierId -- deactivate it (status INACTIVE) instead.
   */
  async remove(id: string): Promise<Supplier> {
    const supplier = await this.supplierModel.findById(id).lean();
    if (!supplier) {
      throw new NotFoundException('ไม่พบ Supplier นี้');
    }
    const [purchaseOrders, movements] = await Promise.all([
      this.purchaseOrderModel.countDocuments({ supplierId: supplier._id }),
      this.stockMovementModel.countDocuments({ supplierId: supplier._id }),
    ]);
    if (purchaseOrders > 0 || movements > 0) {
      const used = [
        purchaseOrders > 0 ? `ใบสั่งซื้อ ${purchaseOrders} ใบ` : null,
        movements > 0 ? `รายการรับสินค้า ${movements} รายการ` : null,
      ]
        .filter(Boolean)
        .join(' และ ');
      throw new ConflictException(
        `ลบ Supplier นี้ไม่ได้ เพราะมี${used}อ้างอิงอยู่ ให้เปลี่ยนสถานะเป็นปิดใช้งานแทน`,
      );
    }
    await this.supplierModel.deleteOne({ _id: supplier._id });
    return supplier;
  }
}
