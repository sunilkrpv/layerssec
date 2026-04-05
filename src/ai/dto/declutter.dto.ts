import { IsArray, IsOptional, IsString } from 'class-validator';

export class DeclutterDto {
  @IsArray()
  nodes: Array<{
    id: string;
    type?: string;
    position?: { x: number; y: number };
    style?: { width?: number; height?: number };
    width?: number;
    height?: number;
    data?: { label?: string };
    parentNode?: string;
  }>;

  @IsArray()
  edges: Array<{
    source: string;
    target: string;
  }>;

  @IsOptional()
  @IsString()
  layerName?: string;
}
