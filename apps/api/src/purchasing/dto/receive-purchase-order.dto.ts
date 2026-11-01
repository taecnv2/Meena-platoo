import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ReceivePurchaseOrderItemDto {
  @IsMongoId()
  ingredientId!: string;

  /** Omit to receive the full remaining (orderedQuantity - receivedQuantity) for this line. */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity?: number;
}

export class ReceivePurchaseOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: ReceivePurchaseOrderItemDto) => item.ingredientId)
  @ValidateNested({ each: true })
  @Type(() => ReceivePurchaseOrderItemDto)
  items!: ReceivePurchaseOrderItemDto[];

  /** Zone to receive into. Defaults to the PO's delivery zone (WAREHOUSE). */
  @IsOptional()
  @IsMongoId()
  zoneId?: string;

  /** Supplier's invoice / delivery-note number, carried onto the movements for the billing statement. */
  @IsOptional()
  @IsString()
  invoiceNo?: string;
}
