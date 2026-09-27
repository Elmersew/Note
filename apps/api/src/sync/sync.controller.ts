import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { SessionUser, SyncOperationResult, SyncPullResponse } from '@sticky-notes/contracts';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { SyncPullQueryDto, SyncPushDto } from './sync.dto';
import { SyncService } from './sync.service';

@ApiTags('sync')
@ApiCookieAuth()
@UseGuards(AuthGuard)
@Controller('sync')
export class SyncController {
  constructor(private readonly syncService: SyncService) {}

  @Get()
  pull(@CurrentUser() user: SessionUser, @Query() query: SyncPullQueryDto): Promise<SyncPullResponse> {
    return this.syncService.pull(user.id, query.cursor);
  }

  @Post('push')
  push(@CurrentUser() user: SessionUser, @Body() input: SyncPushDto): Promise<SyncOperationResult[]> {
    return this.syncService.push(user.id, input.operations);
  }
}
