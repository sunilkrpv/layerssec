import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { IsSafeHttpsUrl } from '../../common/url-safety';

export enum AiProviderDto {
  ANTHROPIC = 'ANTHROPIC',
  OPENAI = 'OPENAI',
  OLLAMA = 'OLLAMA',
  REPLICATE = 'REPLICATE',
}

export class UpdateAiSettingsDto {
  @IsOptional()
  @IsEnum(AiProviderDto)
  provider?: AiProviderDto;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsInt()
  @Min(256)
  @Max(32000)
  maxOutputTokens?: number;

  @IsOptional()
  @IsString()
  ollamaBaseUrl?: string;

  @IsOptional()
  @IsString()
  @IsSafeHttpsUrl()
  openAiBaseUrl?: string;

  /**
   * Anthropic API key — transmitted over HTTPS and immediately encrypted at rest.
   * Send an empty string "" to clear the stored key.
   * Omit the field entirely to leave the existing key unchanged.
   */
  @IsOptional()
  @IsString()
  anthropicApiKey?: string;

  /**
   * OpenAI API key — transmitted over HTTPS and immediately encrypted at rest.
   * Send an empty string "" to clear the stored key.
   * Omit the field entirely to leave the existing key unchanged.
   */
  @IsOptional()
  @IsString()
  openAiApiKey?: string;
}
