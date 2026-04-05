import { IsBoolean, IsInt, IsObject, IsOptional, IsString } from 'class-validator';

export class SubmitPostureScoreDto {
  @IsString()
  projectId: string;

  @IsString()
  diagramId: string;

  @IsInt()
  diagramVersion: number;

  /** Full LayerMap from the frontend ProjectFile */
  @IsObject()
  layers: Record<string, unknown>;

  @IsBoolean()
  @IsOptional()
  useExtendedThinking?: boolean;
}
