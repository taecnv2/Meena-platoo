import { IsIn } from 'class-validator';

export class UpdateZoneStatusDto {
  @IsIn(['ACTIVE', 'INACTIVE'])
  status!: 'ACTIVE' | 'INACTIVE';
}
