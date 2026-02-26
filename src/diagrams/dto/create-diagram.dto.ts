import { IsString, IsOptional, IsEnum, IsObject } from 'class-validator';
import { DiagramType } from '@prisma/client';

export class CreateDiagramDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsEnum(DiagramType)
  type?: DiagramType;

  @IsOptional()
  @IsObject()
  canvasData?: Record<string, any>;
}
