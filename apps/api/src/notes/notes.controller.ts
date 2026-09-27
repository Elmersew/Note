import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { NoteDto, SessionUser, TagDto } from '@sticky-notes/contracts';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateNoteDto, ListNotesQueryDto, NoteVersionDto, ShareNoteDto, UpdateNoteDto } from './notes.dto';
import { NotesService } from './notes.service';

@ApiTags('notes')
@ApiCookieAuth()
@UseGuards(AuthGuard)
@Controller('notes')
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  list(@CurrentUser() user: SessionUser, @Query() query: ListNotesQueryDto): Promise<NoteDto[]> {
    return this.notesService.list(user.id, query);
  }

  @Get('tags')
  listTags(@CurrentUser() user: SessionUser): Promise<TagDto[]> {
    return this.notesService.listTags(user.id);
  }

  @Get(':id')
  get(@CurrentUser() user: SessionUser, @Param('id') id: string): Promise<NoteDto> {
    return this.notesService.get(user.id, id);
  }

  @Post()
  create(@CurrentUser() user: SessionUser, @Body() input: CreateNoteDto): Promise<NoteDto> {
    return this.notesService.create(user.id, input);
  }

  @Patch(':id')
  update(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() input: UpdateNoteDto): Promise<NoteDto> {
    return this.notesService.update(user.id, id, input);
  }

  @HttpCode(204)
  @Delete(':id')
  async remove(@CurrentUser() user: SessionUser, @Param('id') id: string, @Query('baseVersion') baseVersion?: string): Promise<void> {
    await this.notesService.softDelete(user.id, id, baseVersion ? Number(baseVersion) : undefined);
  }

  @Post(':id/restore')
  restore(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() input: NoteVersionDto): Promise<NoteDto> {
    return this.notesService.restore(user.id, id, input.baseVersion);
  }

  @HttpCode(204)
  @Delete(':id/permanent')
  async permanentlyDelete(@CurrentUser() user: SessionUser, @Param('id') id: string): Promise<void> {
    await this.notesService.permanentlyDelete(user.id, id);
  }

  @Post(':id/shares')
  createShare(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Body() input: ShareNoteDto,
  ): Promise<{ token: string; expiresAt: string | null }> {
    return this.notesService.createShare(user.id, id, input);
  }

  @HttpCode(204)
  @Delete(':id/shares')
  async revokeShares(@CurrentUser() user: SessionUser, @Param('id') id: string): Promise<void> {
    await this.notesService.revokeShares(user.id, id);
  }
}

@ApiTags('shares')
@Controller('shares')
export class SharesController {
  constructor(private readonly notesService: NotesService) {}

  @Get(':token')
  get(@Param('token') token: string): Promise<NoteDto> {
    return this.notesService.getShared(token);
  }
}
