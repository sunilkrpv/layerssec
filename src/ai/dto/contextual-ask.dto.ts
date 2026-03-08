import { Type } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';

export class ContextualHistoryItemDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  content: string;
}

export class ContextualAskDto {
  @IsString()
  message: string;

  @IsString()
  projectId: string;

  @IsOptional()
  @IsString()
  diagramId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContextualHistoryItemDto)
  history?: ContextualHistoryItemDto[];
}
