import { Controller, Post, Get, Param, Body, UseGuards, Res } from '@nestjs/common';
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
import { ThreatAnalysisDto } from './dto/threat-analysis.dto';
import { PostureScoreDto } from './dto/posture-score.dto';
import { AttackMindDto } from './dto/attack-mind.dto';
import { DeclutterDto } from './dto/declutter.dto';
import { SubmitThreatAnalysisDto } from '../jobs/dto/submit-threat-analysis.dto';
import { SubmitPostureScoreDto } from '../jobs/dto/submit-posture-score.dto';
import { SubmitAttackMindDto } from './dto/attack-mind.dto';
import { ThreatChatDto } from './dto/threat-chat.dto';

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

  @Post('threat-analysis')
  threatAnalysis(@CurrentUser('id') userId: string, @Body() dto: ThreatAnalysisDto) {
    return this.ai.threatAnalysis(userId, dto);
  }

  // ── Security Posture Score ───────────────────────────────────────────────

  /** Compute + persist a security posture score for a cloud project diagram. */
  @Post('posture-score')
  postureScore(@CurrentUser('id') userId: string, @Body() dto: PostureScoreDto) {
    return this.ai.postureScore(userId, dto);
  }

  // ── Attack Mind Simulator ────────────────────────────────────────────────

  /** Stream a red-team attack simulation for a cloud project diagram. */
  @Post('attack-mind')
  attackMind(
    @CurrentUser('id') userId: string,
    @Body() dto: AttackMindDto,
    @Res() res: Response,
  ) {
    return this.ai.attackMind(userId, dto, res);
  }

  @Post('declutter')
  declutter(@CurrentUser('id') userId: string, @Body() dto: DeclutterDto) {
    return this.ai.declutter(userId, dto);
  }

  @Post('chat/contextual-ask')
  contextualAsk(
    @CurrentUser('id') userId: string,
    @Body() dto: ContextualAskDto,
    @Res() res: Response,
  ) {
    return this.ai.contextualAsk(userId, dto, res);
  }

  /** Multi-turn threat agent chat — streams typed SSE events. */
  @Post('threat-analysis/chat')
  threatAgentChat(
    @CurrentUser('id') userId: string,
    @Body() dto: ThreatChatDto,
    @Res() res: Response,
  ) {
    return this.ai.threatAgentChat(userId, dto, res);
  }

  // ── Async job submission endpoints ───────────────────────────────────────

  /** Submit threat analysis as a background job. Returns { jobId } immediately. */
  @Post('threat-analysis/submit')
  submitThreatAnalysis(
    @CurrentUser('id') userId: string,
    @Body() dto: SubmitThreatAnalysisDto,
  ) {
    return this.ai.submitThreatAnalysis(userId, dto);
  }

  /** Submit posture score as a background job. Returns { jobId } immediately. */
  @Post('posture-score/submit')
  submitPostureScore(
    @CurrentUser('id') userId: string,
    @Body() dto: SubmitPostureScoreDto,
  ) {
    return this.ai.submitPostureScore(userId, dto);
  }

  @Get('projects/:projectId/pipeline-status')
  getPipelineStatus(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.ai.getPipelineStatus(userId, projectId);
  }

  /** SSE: submit posture score job + stream progress until complete. */
  @Post('posture-score/stream')
  postureScoreStream(
    @CurrentUser('id') userId: string,
    @Body() dto: SubmitPostureScoreDto,
    @Res() res: Response,
  ) {
    return this.ai.postureScoreStream(userId, dto, res);
  }

  /** SSE: submit attack mind job + stream progress until complete. */
  @Post('attack-mind/stream')
  attackMindStream(
    @CurrentUser('id') userId: string,
    @Body() dto: SubmitAttackMindDto,
    @Res() res: Response,
  ) {
    return this.ai.attackMindStream(userId, dto, res);
  }

  /** Synthesize executive summary + priority actions from all three security analysis inputs. */
  @Post('intel-synthesis')
  intelSynthesis(
    @CurrentUser('id') userId: string,
    @Body() dto: { projectId: string; threatModelId: string; postureScoreId: string; attackSimulationId?: string },
  ) {
    return this.ai.intelSynthesis(userId, dto);
  }
}
