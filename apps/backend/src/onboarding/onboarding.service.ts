import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';

export interface OnboardingStateResponse {
  aiConfigured: boolean;
  welcomeModalSeenAt: string | null;
  aiTourCompletedAt: string | null;
  firstProjectCreatedAt: string | null;
  firstThreatAnalysisAt: string | null;
  firstPostureScoreAt: string | null;
  firstAttackSimAt: string | null;
  checklistDismissedAt: string | null;
  lastNudgedAt: string | null;
}

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the user's onboarding state. Auto-creates an empty record on
   * first access so every authenticated user has a stable row to update.
   *
   * `aiConfigured` is derived live from `user_ai_settings` existence — it is
   * never cached on the onboarding row to avoid a dual source of truth.
   */
  async getState(userId: string): Promise<OnboardingStateResponse> {
    const [row, aiConfigured] = await Promise.all([
      this.prisma.userOnboarding.upsert({
        where: { userId },
        update: {},
        create: { userId },
      }),
      this.isAiConfigured(userId),
    ]);

    return {
      aiConfigured,
      welcomeModalSeenAt: row.welcomeModalSeenAt?.toISOString() ?? null,
      aiTourCompletedAt: row.aiTourCompletedAt?.toISOString() ?? null,
      firstProjectCreatedAt: row.firstProjectCreatedAt?.toISOString() ?? null,
      firstThreatAnalysisAt: row.firstThreatAnalysisAt?.toISOString() ?? null,
      firstPostureScoreAt: row.firstPostureScoreAt?.toISOString() ?? null,
      firstAttackSimAt: row.firstAttackSimAt?.toISOString() ?? null,
      checklistDismissedAt: row.checklistDismissedAt?.toISOString() ?? null,
      lastNudgedAt: row.lastNudgedAt?.toISOString() ?? null,
    };
  }

  /**
   * Patch client-settable fields. Any field not in the whitelist is ignored,
   * so clients cannot backdoor server-computed milestones.
   */
  async updateState(userId: string, dto: UpdateOnboardingDto): Promise<OnboardingStateResponse> {
    const data: Record<string, Date> = {};
    if (dto.welcomeModalSeenAt) data.welcomeModalSeenAt = new Date(dto.welcomeModalSeenAt);
    if (dto.aiTourCompletedAt) data.aiTourCompletedAt = new Date(dto.aiTourCompletedAt);
    if (dto.checklistDismissedAt) data.checklistDismissedAt = new Date(dto.checklistDismissedAt);
    if (dto.lastNudgedAt) data.lastNudgedAt = new Date(dto.lastNudgedAt);

    await this.prisma.userOnboarding.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });

    return this.getState(userId);
  }

  /**
   * Server-side hook: mark the first-project milestone.
   * Idempotent — only sets the timestamp if it is currently null.
   */
  async markFirstProjectCreated(userId: string): Promise<void> {
    // Ensure the row exists, then conditionally set the timestamp only when still null.
    await this.prisma.userOnboarding.upsert({
      where: { userId },
      update: {},
      create: { userId, firstProjectCreatedAt: new Date() },
    });
    await this.prisma.userOnboarding.updateMany({
      where: { userId, firstProjectCreatedAt: null },
      data: { firstProjectCreatedAt: new Date() },
    });
  }

  /**
   * Server-side hook: mark the first-threat-analysis milestone.
   * Idempotent — only sets the timestamp if it is currently null.
   */
  async markFirstThreatAnalysis(userId: string): Promise<void> {
    await this.prisma.userOnboarding.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    await this.prisma.userOnboarding.updateMany({
      where: { userId, firstThreatAnalysisAt: null },
      data: { firstThreatAnalysisAt: new Date() },
    });
  }

  /** Idempotent — first time a posture score is computed. */
  async markFirstPostureScore(userId: string): Promise<void> {
    await this.prisma.userOnboarding.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    await this.prisma.userOnboarding.updateMany({
      where: { userId, firstPostureScoreAt: null },
      data: { firstPostureScoreAt: new Date() },
    });
  }

  /** Idempotent — first time an attack simulation is saved. */
  async markFirstAttackSim(userId: string): Promise<void> {
    await this.prisma.userOnboarding.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });
    await this.prisma.userOnboarding.updateMany({
      where: { userId, firstAttackSimAt: null },
      data: { firstAttackSimAt: new Date() },
    });
  }

  private async isAiConfigured(userId: string): Promise<boolean> {
    const row = await this.prisma.userAiSettings.findUnique({
      where: { userId },
      select: { id: true },
    });
    return !!row;
  }
}
