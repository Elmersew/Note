import { Body, Controller, Post, Res, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { AiResult, SessionUser } from '@sticky-notes/contracts';
import type { Response } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { AiAskDto, AiTransformDto } from './ai.dto';
import { AiService } from './ai.service';

@ApiTags('ai')
@ApiCookieAuth()
@UseGuards(AuthGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('transform')
  transform(@CurrentUser() user: SessionUser, @Body() input: AiTransformDto): Promise<AiResult> {
    return this.aiService.transform(user.id, input);
  }

  @Post('ask')
  ask(@CurrentUser() user: SessionUser, @Body() input: AiAskDto): Promise<AiResult> {
    return this.aiService.ask(user.id, input);
  }

  @Post('transform/stream')
  async streamTransform(
    @CurrentUser() user: SessionUser,
    @Body() input: AiTransformDto,
    @Res() response: Response,
  ): Promise<void> {
    await this.writeStream(response, this.aiService.streamTransform(user.id, input));
  }

  @Post('ask/stream')
  async streamAsk(@CurrentUser() user: SessionUser, @Body() input: AiAskDto, @Res() response: Response): Promise<void> {
    await this.writeStream(response, this.aiService.streamAsk(user.id, input));
  }

  private async writeStream(response: Response, stream: AsyncGenerator<string>): Promise<void> {
    response.status(200);
    response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    response.setHeader('Cache-Control', 'no-cache, no-transform');
    response.setHeader('Connection', 'keep-alive');
    response.flushHeaders();
    try {
      for await (const delta of stream) response.write(`data: ${JSON.stringify({ delta })}\n\n`);
      response.write('data: [DONE]\n\n');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 请求失败';
      response.write(`event: error\ndata: ${JSON.stringify({ message })}\n\n`);
    } finally {
      response.end();
    }
  }
}
