import { IsObject } from 'class-validator';

export class SuggestDto {
  @IsObject()
  canvasData: Record<string, any>;
}
