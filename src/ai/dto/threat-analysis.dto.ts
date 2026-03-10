import { IsArray, IsOptional, IsString } from 'class-validator';

class NodeInputDto {
  id: string;
  type?: string;
  label?: string;
  technology?: string;
  description?: string;
  trustLevel?: string;
}

class EdgeInputDto {
  id: string;
  source: string;
  target: string;
  label?: string;
}

class TrustBoundaryDto {
  id: string;
  label?: string;
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
  nodes: NodeInputDto[];

  @IsArray()
  edges: EdgeInputDto[];

  @IsOptional()
  @IsArray()
  trustBoundaries?: TrustBoundaryDto[];
}
