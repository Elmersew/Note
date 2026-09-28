package com.stickynotes.api.events;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.stickynotes.api.common.ApiException;
import com.stickynotes.api.contract.Dtos.CalendarEventDto;
import com.stickynotes.api.contract.Dtos.ChangeOperation;
import com.stickynotes.api.contract.Dtos.EntityType;
import com.stickynotes.api.entity.CalendarEventEntity;
import com.stickynotes.api.mapper.CalendarEventMapper;
import com.stickynotes.api.notes.NotesService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@Service
public class EventsService {

    private final CalendarEventMapper eventMapper;
    private final NotesService notesService;

    public EventsService(CalendarEventMapper eventMapper, NotesService notesService) {
        this.eventMapper = eventMapper;
        this.notesService = notesService;
    }

    public List<CalendarEventDto> list(String userId, String from, String to) {
        QueryWrapper<CalendarEventEntity> query = new QueryWrapper<>();
        query.eq("user_id", userId).isNull("deleted_at");
        if (from != null && !from.isBlank()) {
            query.ge("ends_at", parseInstant(from));
        }
        if (to != null && !to.isBlank()) {
            query.le("starts_at", parseInstant(to));
        }
        query.orderByAsc("starts_at").last("LIMIT 500");
        return eventMapper.selectList(query).stream().map(EventsService::toDto).toList();
    }

    @Transactional
    public CalendarEventDto create(String userId, EventDtos.CreateEventRequest input) {
        Instant startsAt = parseInstant(input.startsAt());
        Instant endsAt = parseInstant(input.endsAt());
        assertDateRange(startsAt, endsAt);
        if (input.sourceNoteId() != null) {
            notesService.findOwnedActive(userId, input.sourceNoteId());
        }
        CalendarEventEntity event = new CalendarEventEntity();
        event.setId(input.id() != null ? input.id() : UUID.randomUUID().toString());
        event.setUserId(userId);
        event.setTitle(input.title().trim());
        event.setDescription(input.description() == null ? "" : input.description());
        event.setStartsAt(startsAt);
        event.setEndsAt(endsAt);
        event.setTimezone(input.timezone());
        event.setIsAllDay(Boolean.TRUE.equals(input.isAllDay()));
        event.setLocation(input.location());
        event.setSourceNoteId(input.sourceNoteId());
        event.setVersion(1);
        Instant now = Instant.now();
        event.setCreatedAt(now);
        event.setUpdatedAt(now);
        eventMapper.insert(event);
        notesService.emit(userId, EntityType.EVENT, event.getId(), ChangeOperation.UPSERT, 1);
        return toDto(event);
    }

    @Transactional
    public CalendarEventDto update(String userId, String id, EventDtos.UpdateEventRequest input) {
        CalendarEventEntity current = findOwned(userId, id);
        if (!Objects.equals(current.getVersion(), input.baseVersion())) {
            throw ApiException.conflict("日程已在其他设备更新");
        }
        Instant startsAt = input.startsAt() == null ? current.getStartsAt() : parseInstant(input.startsAt());
        Instant endsAt = input.endsAt() == null ? current.getEndsAt() : parseInstant(input.endsAt());
        assertDateRange(startsAt, endsAt);

        UpdateWrapper<CalendarEventEntity> update = new UpdateWrapper<>();
        update.eq("id", id).eq("user_id", userId).eq("version", input.baseVersion());
        update.set("version", current.getVersion() + 1).set("updated_at", Instant.now());
        if (input.title() != null) {
            update.set("title", input.title().trim());
        }
        if (input.description() != null) {
            update.set("description", input.description());
        }
        if (input.startsAt() != null) {
            update.set("starts_at", startsAt);
        }
        if (input.endsAt() != null) {
            update.set("ends_at", endsAt);
        }
        if (input.timezone() != null) {
            update.set("timezone", input.timezone());
        }
        if (input.isAllDay() != null) {
            update.set("is_all_day", input.isAllDay());
        }
        if (input.location() != null) {
            update.set("location", input.location().isBlank() ? null : input.location());
        }
        if (eventMapper.update(null, update) != 1) {
            throw ApiException.conflict("日程已在其他设备更新");
        }
        CalendarEventDto dto = toDto(eventMapper.selectById(id));
        notesService.emit(userId, EntityType.EVENT, id, ChangeOperation.UPSERT, dto.version());
        return dto;
    }

    @Transactional
    public void remove(String userId, String id) {
        CalendarEventEntity current = findOwned(userId, id);
        UpdateWrapper<CalendarEventEntity> update = new UpdateWrapper<>();
        update.eq("id", id)
                .set("deleted_at", Instant.now())
                .set("version", current.getVersion() + 1)
                .set("updated_at", Instant.now());
        eventMapper.update(null, update);
        notesService.emit(userId, EntityType.EVENT, id, ChangeOperation.DELETE, current.getVersion() + 1);
    }

    private CalendarEventEntity findOwned(String userId, String id) {
        CalendarEventEntity event = eventMapper.selectOne(new QueryWrapper<CalendarEventEntity>()
                .eq("id", id).eq("user_id", userId).isNull("deleted_at").last("LIMIT 1"));
        if (event == null) {
            throw ApiException.notFound("日程不存在");
        }
        return event;
    }

    private static Instant parseInstant(String value) {
        try {
            return Instant.parse(value);
        } catch (Exception e) {
            throw ApiException.badRequest("时间格式无效");
        }
    }

    private static void assertDateRange(Instant startsAt, Instant endsAt) {
        if (!endsAt.isAfter(startsAt)) {
            throw ApiException.conflict("结束时间必须晚于开始时间");
        }
    }

    static CalendarEventDto toDto(CalendarEventEntity event) {
        return new CalendarEventDto(event.getId(), event.getTitle(), event.getDescription(),
                event.getStartsAt(), event.getEndsAt(), event.getTimezone(), Boolean.TRUE.equals(event.getIsAllDay()),
                event.getLocation(), event.getSourceNoteId(), event.getVersion() == null ? 1 : event.getVersion(),
                event.getCreatedAt(), event.getUpdatedAt());
    }
}
