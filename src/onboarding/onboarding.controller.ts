import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { OnboardingService } from './onboarding.service';
import { UpdateOnboardingDto } from './dto/update-onboarding.dto';

@Controller('users/me/onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  getState(@CurrentUser('id') userId: string) {
    return this.onboarding.getState(userId);
  }

  @Patch()
  updateState(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateOnboardingDto,
  ) {
    return this.onboarding.updateState(userId, dto);
  }
}
