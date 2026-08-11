import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsMongoId,
  IsNumber,
  IsPositive,
  ValidateNested,
} from 'class-validator';

export class FulfillRequisitionItemDto {
  @IsMongoId()
  ingredientId!: string;

  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  quantity!: number;
}

/** No fromZoneId -- fulfillment always draws from the requisition's own fromZoneId (the warehouse). */
export class FulfillRequisitionDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => FulfillRequisitionItemDto)
  items!: FulfillRequisitionItemDto[];
}
