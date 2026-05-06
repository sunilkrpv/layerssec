import { IsArray, IsInt, IsOptional, IsString } from 'class-validator';

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

class TrustBoundaryInputDto {
  id: string;
  label?: string;
  trustLevel?: string;
}

export class SubmitThreatAnalysisDto {
  @IsString()
  projectId: string;

  @IsString()
  diagramId: string;

  @IsInt()
  diagramVersion: number;

  @IsString()
  layerId: string;

  @IsOptional()
  @IsString()
  layerName?: string;

  @IsOptional()
  @IsString()
  modelName?: string;

  @IsArray()
  nodes: NodeInputDto[];

  @IsArray()
  edges: EdgeInputDto[];

  @IsOptional()
  @IsArray()
  trustBoundaries?: TrustBoundaryInputDto[];
}
