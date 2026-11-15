import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { PurchaseOrder } from '../purchasing/schemas/purchase-order.schema';
import { StockMovement } from '../stock-movements/schemas/stock-movement.schema';
import { Supplier } from './schemas/supplier.schema';
import { SuppliersService } from './suppliers.service';

function queryMock<T>(result: T) {
  return { lean: jest.fn().mockResolvedValue(result) };
}

describe('SuppliersService.remove', () => {
  let service: SuppliersService;
  let supplierModel: { findById: jest.Mock; deleteOne: jest.Mock };
  let purchaseOrderModel: { countDocuments: jest.Mock };
  let stockMovementModel: { countDocuments: jest.Mock };

  const supplierId = new Types.ObjectId();
  const supplier = { _id: supplierId, code: 'SP001', name: 'วิชัย' };

  beforeEach(async () => {
    supplierModel = {
      findById: jest.fn(() => queryMock(supplier)),
      deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    };
    purchaseOrderModel = { countDocuments: jest.fn().mockResolvedValue(0) };
    stockMovementModel = { countDocuments: jest.fn().mockResolvedValue(0) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuppliersService,
        { provide: getModelToken(Supplier.name), useValue: supplierModel },
        {
          provide: getModelToken(PurchaseOrder.name),
          useValue: purchaseOrderModel,
        },
        {
          provide: getModelToken(StockMovement.name),
          useValue: stockMovementModel,
        },
      ],
    }).compile();

    service = module.get(SuppliersService);
  });

  it('deletes a supplier that nothing references and returns it', async () => {
    await expect(service.remove(supplierId.toString())).resolves.toBe(supplier);
    expect(purchaseOrderModel.countDocuments).toHaveBeenCalledWith({
      supplierId,
    });
    expect(stockMovementModel.countDocuments).toHaveBeenCalledWith({
      supplierId,
    });
    expect(supplierModel.deleteOne).toHaveBeenCalledWith({ _id: supplierId });
  });

  it('throws NotFound for an unknown supplier', async () => {
    supplierModel.findById.mockReturnValueOnce(queryMock(null));

    await expect(service.remove(supplierId.toString())).rejects.toThrow(
      NotFoundException,
    );
    expect(supplierModel.deleteOne).not.toHaveBeenCalled();
  });

  it('refuses when a purchase order references the supplier', async () => {
    purchaseOrderModel.countDocuments.mockResolvedValueOnce(2);

    await expect(service.remove(supplierId.toString())).rejects.toThrow(
      new ConflictException(
        'ลบ Supplier นี้ไม่ได้ เพราะมีใบสั่งซื้อ 2 ใบอ้างอิงอยู่ ให้เปลี่ยนสถานะเป็นปิดใช้งานแทน',
      ),
    );
    expect(supplierModel.deleteOne).not.toHaveBeenCalled();
  });

  it('refuses when a stock-in movement references the supplier', async () => {
    stockMovementModel.countDocuments.mockResolvedValueOnce(3);

    await expect(service.remove(supplierId.toString())).rejects.toThrow(
      ConflictException,
    );
    expect(supplierModel.deleteOne).not.toHaveBeenCalled();
  });
});
