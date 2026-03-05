import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
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
}

export class SaveChatMessagesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatMessageItemDto)
  messages: ChatMessageItemDto[];
}
