import { IsString, IsObject } from 'class-validator';

export class RefineDto {
  @IsString()
  prompt: string;

  @IsObject()
  canvasData: Record<string, any>;

  @IsString()
  diagramId: string;
}
