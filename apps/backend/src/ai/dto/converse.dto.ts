import { IsArray, IsIn, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ConverseMessageDto {
  @IsIn(['user', 'ai'])
  role: 'user' | 'ai';

  @IsString()
  text: string;
}

export class ConverseDto {
  @IsUUID()
  projectId: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConverseMessageDto)
  messages: ConverseMessageDto[];
}
