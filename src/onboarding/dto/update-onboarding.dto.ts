import { IsOptional, IsISO8601 } from 'class-validator';

/**
 * Client-settable onboarding milestone timestamps.
 *
 * Server-computed fields — firstProjectCreatedAt, firstThreatAnalysisAt —
 * are intentionally NOT exposed here. They are set server-side and any
 * client attempt to update them is silently ignored (not in the whitelist).
 */
export class UpdateOnboardingDto {
  @IsOptional()
  @IsISO8601()
  welcomeModalSeenAt?: string;

  @IsOptional()
  @IsISO8601()
  aiTourCompletedAt?: string;

  @IsOptional()
  @IsISO8601()
  checklistDismissedAt?: string;

  @IsOptional()
  @IsISO8601()
  lastNudgedAt?: string;
}
