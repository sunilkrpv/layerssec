import { IsEnum, IsOptional, IsString } from 'class-validator';
import { StrideCategory, ThreatSeverity, ThreatStatus } from '@prisma/client';

export class UpdateThreatDto {
  @IsOptional() @IsString()
  title?: string;

  @IsOptional() @IsString()
  description?: string;

  @IsOptional() @IsString()
  targetLabel?: string;

  @IsOptional() @IsEnum(StrideCategory)
  strideCategory?: StrideCategory;

  @IsOptional() @IsEnum(ThreatSeverity)
  severity?: ThreatSeverity;

  @IsOptional() @IsEnum(ThreatStatus)
  status?: ThreatStatus;

  @IsOptional() @IsString()
  mitigationNotes?: string;

  @IsOptional() @IsString()
  mitigationAdvice?: string;
}
