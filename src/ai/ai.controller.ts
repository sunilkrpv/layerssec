import { Controller, Post, Body, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AiService } from './ai.service';
import { GenerateDto } from './dto/generate.dto';
import { SuggestDto } from './dto/suggest.dto';
import { RefineDto } from './dto/refine.dto';
import { ChatGenerateDto } from './dto/chat-generate.dto';
import { ChatEvaluateDto } from './dto/chat-evaluate.dto';
import { ChatAskDto } from './dto/chat-ask.dto';
import { ContextualAskDto } from './dto/contextual-ask.dto';

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

  @Post('chat/generate')
  chatGenerate(@CurrentUser('id') userId: string, @Body() dto: ChatGenerateDto) {
    return this.ai.chatGenerate(userId, dto);
  }

  @Post('chat/evaluate')
  chatEvaluate(
    @CurrentUser('id') userId: string,
    @Body() dto: ChatEvaluateDto,
    @Res() res: Response,
  ) {
    return this.ai.chatEvaluate(userId, dto, res);
  }

  @Post('chat/ask')
  chatAsk(
    @CurrentUser('id') userId: string,
    @Body() dto: ChatAskDto,
    @Res() res: Response,
  ) {
    return this.ai.chatAsk(userId, dto, res);
  }

  @Post('chat/contextual-ask')
  contextualAsk(
    @CurrentUser('id') userId: string,
    @Body() dto: ContextualAskDto,
    @Res() res: Response,
  ) {
    return this.ai.contextualAsk(userId, dto, res);
  }
}
