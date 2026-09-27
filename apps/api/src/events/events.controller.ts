import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiTags } from '@nestjs/swagger';
import type { CalendarEventDto, SessionUser } from '@sticky-notes/contracts';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CreateEventDto, ListEventsQueryDto, UpdateEventDto } from './events.dto';
import { EventsService } from './events.service';

@ApiTags('events')
@ApiCookieAuth()
@UseGuards(AuthGuard)
@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  list(@CurrentUser() user: SessionUser, @Query() query: ListEventsQueryDto): Promise<CalendarEventDto[]> {
    return this.eventsService.list(user.id, query);
  }

  @Post()
  create(@CurrentUser() user: SessionUser, @Body() input: CreateEventDto): Promise<CalendarEventDto> {
    return this.eventsService.create(user.id, input);
  }

  @Patch(':id')
  update(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body() input: UpdateEventDto): Promise<CalendarEventDto> {
    return this.eventsService.update(user.id, id, input);
  }

  @HttpCode(204)
  @Delete(':id')
  async remove(@CurrentUser() user: SessionUser, @Param('id') id: string): Promise<void> {
    await this.eventsService.remove(user.id, id);
  }
}
