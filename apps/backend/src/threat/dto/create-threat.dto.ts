import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { StrideCategory, ThreatSeverity } from '@prisma/client';

export class CreateThreatDto {
  @IsString() @IsNotEmpty()
  targetId: string;

  @IsString() @IsNotEmpty()
  targetType: string;

  @IsString() @IsNotEmpty()
  targetLabel: string;

  @IsString() @IsNotEmpty()
  layerId: string;

  @IsEnum(StrideCategory)
  strideCategory: StrideCategory;

  @IsString() @IsNotEmpty()
  title: string;

  @IsString() @IsNotEmpty()
  description: string;

  @IsEnum(ThreatSeverity)
  severity: ThreatSeverity;

  @IsString() @IsOptional()
  mitigationNotes?: string;
}
