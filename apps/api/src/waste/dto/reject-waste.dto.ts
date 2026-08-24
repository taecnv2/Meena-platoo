import { IsString, MinLength } from 'class-validator';

export class RejectWasteDto {
  @IsString()
  @MinLength(1)
  rejectionReason!: string;
}
