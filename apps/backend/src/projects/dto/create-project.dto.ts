import { IsString, IsOptional, IsBoolean, IsArray, MaxLength, IsEnum, IsUrl, ArrayUnique } from 'class-validator';
import { Environment } from '@prisma/client';

const COMPLIANCE_WHITELIST = ['SOC2', 'ISO27001', 'PCI', 'HIPAA', 'GDPR', 'FedRAMP'] as const;
type ComplianceTag = typeof COMPLIANCE_WHITELIST[number];

export class CreateProjectDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  techStack?: string[];

  @IsOptional()
  @IsEnum(Environment)
  environment?: Environment;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(COMPLIANCE_WHITELIST, { each: true })
  compliance?: ComplianceTag[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsUrl()
  repoUrl?: string;
}
