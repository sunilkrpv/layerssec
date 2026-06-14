import { IsOptional, IsString, IsUUID } from 'class-validator';

export class SuggestFlowDto {
  @IsUUID() projectId!: string;
  @IsString() flowName!: string;
  @IsOptional() @IsString() description?: string;
}
