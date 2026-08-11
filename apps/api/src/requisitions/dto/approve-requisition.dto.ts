import { Type } from 'class-transformer';
import {
  IsArray,
  IsMongoId,
  IsNumber,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';

export class ApproveRequisitionItemDto {
  @IsMongoId()
  ingredientId!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  approvedQuantity!: number;
}

export class ApproveRequisitionDto {
  /** Omit an item (or the whole array) to approve the requested quantity as-is. */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApproveRequisitionItemDto)
  items?: ApproveRequisitionItemDto[];
}
