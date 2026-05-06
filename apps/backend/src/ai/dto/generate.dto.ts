import { IsString, IsOptional, IsObject } from 'class-validator';

export class GenerateDto {
  @IsString()
  prompt: string;

  @IsOptional()
  @IsObject()
  canvasData?: Record<string, any>;

  @IsOptional()
  @IsString()
  diagramId?: string;
}
