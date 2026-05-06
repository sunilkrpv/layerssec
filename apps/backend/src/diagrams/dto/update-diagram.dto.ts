import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { DiagramType } from '@prisma/client';

export class UpdateDiagramDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(DiagramType)
  type?: DiagramType;

  @IsOptional()
  @IsObject()
  canvasData?: Record<string, any>;

  @IsOptional()
  @IsString()
  thumbnail?: string;
}
