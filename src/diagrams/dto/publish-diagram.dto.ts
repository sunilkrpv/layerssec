import { IsOptional, IsString } from 'class-validator';

export class PublishDiagramDto {
  @IsOptional()
  @IsString()
  comment?: string;
}
