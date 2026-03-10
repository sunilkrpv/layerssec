import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ThreatSeverity, ThreatStatus } from '@prisma/client';

export class UpdateThreatDto {
  @IsOptional()
  @IsEnum(ThreatStatus)
  status?: ThreatStatus;

  @IsOptional()
  @IsString()
  mitigationNotes?: string;

  @IsOptional()
  @IsEnum(ThreatSeverity)
  severity?: ThreatSeverity;
}
