import { IsString, MinLength } from 'class-validator';

export class RejectRequisitionDto {
  @IsString()
  @MinLength(1)
  rejectionReason!: string;
}
