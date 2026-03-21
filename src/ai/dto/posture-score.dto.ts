import { IsString, IsBoolean, IsOptional, IsNumber, IsObject } from 'class-validator';

export class PostureScoreDto {
  @IsString()
  projectId: string;

  @IsString()
  diagramId: string;

  @IsNumber()
  diagramVersion: number;

  /** Full LayerMap from the frontend ProjectFile */
  @IsObject()
  layers: Record<string, unknown>;

  @IsBoolean()
  @IsOptional()
  useExtendedThinking?: boolean;
}
