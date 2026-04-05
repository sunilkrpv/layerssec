import { IsArray, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

class MessageDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  content: string;
}

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

class TrustBoundaryInputDto {
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsString()
  trustLevel?: string;
}

export class ThreatChatDto {
  @IsString()
  projectId: string;

  @IsString()
  diagramId: string;

  @IsString()
  layerId: string;

  @IsOptional()
  @IsString()
  layerName?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageDto)
  messages: MessageDto[];

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
  @Type(() => TrustBoundaryInputDto)
  trustBoundaries?: TrustBoundaryInputDto[];
}
