import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CalendarEvent, ChangeOperation, EntityType } from '@prisma/client';
import type { CalendarEventDto } from '@sticky-notes/contracts';
import { randomUUID } from 'node:crypto';
import { toChangeDto } from '../notes/note.mapper';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import type { CreateEventDto, ListEventsQueryDto, UpdateEventDto } from './events.dto';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async list(userId: string, query: ListEventsQueryDto): Promise<CalendarEventDto[]> {
    const events = await this.prisma.calendarEvent.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(query.from ? { endsAt: { gte: new Date(query.from) } } : {}),
        ...(query.to ? { startsAt: { lte: new Date(query.to) } } : {}),
      },
      orderBy: { startsAt: 'asc' },
      take: 500,
    });
    return events.map(this.toDto);
  }

  async create(userId: string, input: CreateEventDto): Promise<CalendarEventDto> {
    this.assertDateRange(input.startsAt, input.endsAt);
    const result = await this.prisma.$transaction(async (tx) => {
      if (input.sourceNoteId) {
        const source = await tx.note.findFirst({ where: { id: input.sourceNoteId, userId, deletedAt: null } });
        if (!source) throw new NotFoundException('来源便签不存在');
      }
      const event = await tx.calendarEvent.create({
        data: {
          id: input.id ?? randomUUID(),
          userId,
          title: input.title.trim(),
          description: input.description ?? '',
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
          timezone: input.timezone,
          isAllDay: input.isAllDay ?? false,
          location: input.location ?? null,
          sourceNoteId: input.sourceNoteId ?? null,
        },
      });
      const change = await tx.changeLog.create({
        data: { userId, entityType: EntityType.EVENT, entityId: event.id, operation: ChangeOperation.UPSERT, version: event.version },
      });
      return { event, change };
    });
    this.realtime.emitChange(userId, toChangeDto(result.change));
    return this.toDto(result.event);
  }

  async update(userId: string, id: string, input: UpdateEventDto): Promise<CalendarEventDto> {
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.calendarEvent.findFirst({ where: { id, userId, deletedAt: null } });
      if (!current) throw new NotFoundException('日程不存在');
      if (current.version !== input.baseVersion) throw new ConflictException('日程已在其他设备更新');
      const startsAt = input.startsAt ?? current.startsAt.toISOString();
      const endsAt = input.endsAt ?? current.endsAt.toISOString();
      this.assertDateRange(startsAt, endsAt);
      const updated = await tx.calendarEvent.updateMany({
        where: { id, userId, version: input.baseVersion },
        data: {
          ...(input.title !== undefined ? { title: input.title.trim() } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(input.startsAt !== undefined ? { startsAt: new Date(input.startsAt) } : {}),
          ...(input.endsAt !== undefined ? { endsAt: new Date(input.endsAt) } : {}),
          ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
          ...(input.isAllDay !== undefined ? { isAllDay: input.isAllDay } : {}),
          ...(input.location !== undefined ? { location: input.location } : {}),
          version: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new ConflictException('日程已在其他设备更新');
      const event = await tx.calendarEvent.findUniqueOrThrow({ where: { id } });
      const change = await tx.changeLog.create({
        data: { userId, entityType: EntityType.EVENT, entityId: id, operation: ChangeOperation.UPSERT, version: event.version },
      });
      return { event, change };
    });
    this.realtime.emitChange(userId, toChangeDto(result.change));
    return this.toDto(result.event);
  }

  async remove(userId: string, id: string): Promise<void> {
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.calendarEvent.findFirst({ where: { id, userId, deletedAt: null } });
      if (!current) throw new NotFoundException('日程不存在');
      const event = await tx.calendarEvent.update({ where: { id }, data: { deletedAt: new Date(), version: { increment: 1 } } });
      const change = await tx.changeLog.create({
        data: { userId, entityType: EntityType.EVENT, entityId: id, operation: ChangeOperation.DELETE, version: event.version },
      });
      return { event, change };
    });
    this.realtime.emitChange(userId, toChangeDto(result.change));
  }

  private assertDateRange(startsAt: string, endsAt: string): void {
    if (new Date(endsAt) <= new Date(startsAt)) throw new ConflictException('结束时间必须晚于开始时间');
  }

  private toDto(event: CalendarEvent): CalendarEventDto {
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      startsAt: event.startsAt.toISOString(),
      endsAt: event.endsAt.toISOString(),
      timezone: event.timezone,
      isAllDay: event.isAllDay,
      location: event.location,
      sourceNoteId: event.sourceNoteId,
      version: event.version,
      createdAt: event.createdAt.toISOString(),
      updatedAt: event.updatedAt.toISOString(),
    };
  }
}
