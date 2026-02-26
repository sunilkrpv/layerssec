import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AiService } from './ai.service';
import { GenerateDto } from './dto/generate.dto';
import { SuggestDto } from './dto/suggest.dto';
import { RefineDto } from './dto/refine.dto';

@Controller('ai')
@UseGuards(JwtAuthGuard)
export class AiController {
  constructor(private ai: AiService) {}

  @Post('generate')
  generate(@CurrentUser('id') userId: string, @Body() dto: GenerateDto) {
    return this.ai.generate(userId, dto.prompt, dto.canvasData, dto.diagramId);
  }

  @Post('suggest')
  suggest(@CurrentUser('id') userId: string, @Body() dto: SuggestDto) {
    return this.ai.suggest(userId, dto.canvasData);
  }

  @Post('refine')
  refine(@CurrentUser('id') userId: string, @Body() dto: RefineDto) {
    return this.ai.refine(userId, dto.prompt, dto.canvasData, dto.diagramId);
  }
}
