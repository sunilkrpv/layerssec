import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class NodeInputDto {
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  technology?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  trustLevel?: string;
}

class EdgeInputDto {
  @IsString()
  id: string;

  @IsString()
  source: string;

  @IsString()
  target: string;

  @IsOptional()
  @IsString()
  label?: string;
}

class TrustBoundaryDto {
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  trustLevel?: string;
}

export class ThreatAnalysisDto {
  @IsString()
  diagramId: string;

  @IsString()
  layerId: string;

  @IsOptional()
  @IsString()
  layerName?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NodeInputDto)
  nodes: NodeInputDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EdgeInputDto)
  edges: EdgeInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TrustBoundaryDto)
  trustBoundaries?: TrustBoundaryDto[];
}
