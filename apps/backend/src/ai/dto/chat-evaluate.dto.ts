import { IsArray, IsOptional, IsString } from 'class-validator';

export class ChatEvaluateDto {
  @IsArray()
  nodes: Array<{
    id: string;
    type?: string;
    data?: { label?: string; technology?: string; description?: string };
  }>;

  @IsArray()
  edges: Array<{
    id: string;
    source: string;
    target: string;
    label?: string;
  }>;

  @IsOptional()
  @IsString()
  layerName?: string;

  @IsOptional()
  @IsString()
  userQuestion?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  layerId?: string;
}
