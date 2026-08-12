import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsPositive,
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
}
