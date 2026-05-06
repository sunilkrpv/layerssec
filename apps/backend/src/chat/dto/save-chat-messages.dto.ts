import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class ChatMessageItemDto {
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @IsString()
  content: string;

  @IsOptional()
  @IsString()
  layerId?: string;

  @IsOptional()
  @IsString()
  layerName?: string;

  @IsOptional()
  @IsObject()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  diagramData?: Record<string, any>;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsInt()
  inputTokens?: number;

  @IsOptional()
  @IsInt()
  outputTokens?: number;
}

export class SaveChatMessagesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageItemDto)
  messages: ChatMessageItemDto[];
}
