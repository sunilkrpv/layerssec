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

  /** Optional: link to a saved ThreatModel to enrich the posture score with threat findings */
  @IsString()
  @IsOptional()
  threatModelId?: string;
}
