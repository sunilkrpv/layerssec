import { IsOptional, IsString } from 'class-validator';

export class ChatGenerateDto {
  @IsString()
  prompt: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  diagramId?: string;

  @IsOptional()
  @IsString()
  layerId?: string;

  @IsOptional()
  @IsString()
  layerName?: string;
}
