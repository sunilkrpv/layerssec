import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { StrideCategory, ThreatSeverity } from '@prisma/client';

export class ThreatItemDto {
  @IsString()
  targetId: string;

  @IsString()
  targetType: string;

  @IsString()
  targetLabel: string;

  @IsString()
  layerId: string;

  @IsEnum(StrideCategory)
  strideCategory: StrideCategory;

  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsEnum(ThreatSeverity)
  severity: ThreatSeverity;
}

export class SaveThreatModelDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsString()
  diagramId: string;

  @IsInt()
  diagramVersion: number;

  @IsObject()
  snapshotData: Record<string, any>;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ThreatItemDto)
  threats: ThreatItemDto[];
}
