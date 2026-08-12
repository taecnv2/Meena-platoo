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
  Min,
  ValidateNested,
} from 'class-validator';

export class CreatePurchaseOrderItemDto {
  @IsMongoId()
  ingredientId!: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  orderedQuantity!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  unitCost!: number;
}

export class CreatePurchaseOrderDto {
  @IsMongoId()
  supplierId!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: CreatePurchaseOrderItemDto) => item.ingredientId)
  @ValidateNested({ each: true })
  @Type(() => CreatePurchaseOrderItemDto)
  items!: CreatePurchaseOrderItemDto[];

  @IsOptional()
  @IsString()
  remark?: string;
}
