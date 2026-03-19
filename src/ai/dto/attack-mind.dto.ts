import { IsString, IsBoolean, IsOptional, IsObject } from 'class-validator';

export class AttackMindDto {
  @IsString()
  projectId: string;

  @IsString()
  diagramId: string;

  /** Full LayerMap from the frontend ProjectFile */
  @IsObject()
  layers: Record<string, unknown>;

  @IsString()
  @IsOptional()
  entryPointNodeId?: string;

  @IsBoolean()
  @IsOptional()
  useExtendedThinking?: boolean;
}

export class SaveAttackSimulationDto {
  @IsString()
  projectId: string;

  @IsString()
  diagramId: string;

  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  entryPointId?: string;

  /** Serialized array of AttackPath objects */
  paths: unknown[];
}
