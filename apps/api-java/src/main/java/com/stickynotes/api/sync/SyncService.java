package com.stickynotes.api.sync;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stickynotes.api.common.ApiException;
import com.stickynotes.api.common.NoteContent;
import com.stickynotes.api.contract.Dtos.ChangeOperation;
import com.stickynotes.api.contract.Dtos.ChangeDto;
import com.stickynotes.api.contract.Dtos.EntityType;
import com.stickynotes.api.contract.Dtos.NoteDto;
import com.stickynotes.api.contract.Dtos.SyncOperationResult;
import com.stickynotes.api.contract.Dtos.SyncPullResponse;
import com.stickynotes.api.entity.ChangeLogEntity;
import com.stickynotes.api.entity.MutationEntity;
import com.stickynotes.api.entity.NoteEntity;
import com.stickynotes.api.mapper.ChangeLogMapper;
import com.stickynotes.api.mapper.MutationMapper;
import com.stickynotes.api.mapper.NoteMapper;
import com.stickynotes.api.notes.NotesService;
import com.stickynotes.api.realtime.RealtimeService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
public class SyncService {

    private final NoteMapper noteMapper;
    private final ChangeLogMapper changeLogMapper;
    private final MutationMapper mutationMapper;
    private final NotesService notesService;
    private final RealtimeService realtime;
    private final TransactionTemplate transactions;
    private final ObjectMapper objectMapper;

    public SyncService(NoteMapper noteMapper, ChangeLogMapper changeLogMapper, MutationMapper mutationMapper,
                       NotesService notesService, RealtimeService realtime,
                       TransactionTemplate transactions, ObjectMapper objectMapper) {
        this.noteMapper = noteMapper;
        this.changeLogMapper = changeLogMapper;
        this.mutationMapper = mutationMapper;
        this.notesService = notesService;
        this.realtime = realtime;
        this.transactions = transactions;
        this.objectMapper = objectMapper;
    }

    public SyncPullResponse pull(String userId, String cursorValue) {
        long cursor;
        try {
            cursor = cursorValue == null || cursorValue.isBlank() ? 0 : Long.parseLong(cursorValue);
        } catch (NumberFormatException e) {
            throw ApiException.badRequest("cursor 必须是数字");
        }
        // cursor 是 MySQL 保留字，实体映射会生成不带反引号的列名导致语法错误，改用 selectMaps 手动映射
        List<Map<String, Object>> rows = changeLogMapper.selectMaps(new QueryWrapper<ChangeLogEntity>()
                .select("`cursor`", "user_id", "entity_type", "entity_id", "operation", "version", "changed_at")
                .eq("user_id", userId).gt("`cursor`", cursor).orderByAsc("`cursor`").last("LIMIT 500"));
        List<ChangeDto> dtos = rows.stream().map(this::toChangeDto).toList();
        String next = rows.isEmpty() ? String.valueOf(cursor)
                : String.valueOf(((Number) rows.get(rows.size() - 1).get("cursor")).longValue());
        return new SyncPullResponse(next, dtos);
    }

    public List<SyncOperationResult> push(String userId, List<SyncDtos.SyncOperationRequest> operations) {
        List<SyncOperationResult> results = new ArrayList<>();
        for (SyncDtos.SyncOperationRequest operation : operations) {
            if (operation.entityType() != EntityType.NOTE) {
                results.add(SyncOperationResult.failed(operation.idempotencyKey(), "离线同步目前仅支持便签"));
                continue;
            }
            Applied applied = transactions.execute(status -> applyNoteOperation(userId, operation));
            results.add(applied.result);
            if (applied.change != null) {
                realtime.emitChange(userId, applied.change);
            }
        }
        return results;
    }

    private record Applied(SyncOperationResult result, ChangeDto change) {
    }

    private Applied applyNoteOperation(String userId, SyncDtos.SyncOperationRequest operation) {
        MutationEntity previous = mutationMapper.selectOne(new QueryWrapper<MutationEntity>()
                .eq("user_id", userId).eq("idempotency_key", operation.idempotencyKey()).last("LIMIT 1"));
        if (previous != null) {
            return new Applied(readResult(previous.getResponse()), null);
        }

        NoteEntity current = noteMapper.selectOne(new QueryWrapper<NoteEntity>()
                .eq("id", operation.entityId()).eq("user_id", userId).last("LIMIT 1"));
        SyncOperationResult result;
        ChangeDto change = null;

        if (operation.operation() == ChangeOperation.DELETE) {
            if (current == null) {
                result = SyncOperationResult.applied(operation.idempotencyKey(), null);
            } else if (operation.baseVersion() != null && !Objects.equals(current.getVersion(), operation.baseVersion())) {
                result = SyncOperationResult.conflict(operation.idempotencyKey(), notesService.toDto(current), "服务端版本更新");
            } else {
                UpdateWrapper<NoteEntity> update = new UpdateWrapper<>();
                update.eq("id", current.getId())
                        .set("deleted_at", Instant.now())
                        .set("version", current.getVersion() + 1)
                        .set("updated_at", Instant.now());
                noteMapper.update(null, update);
                NoteEntity note = noteMapper.selectById(current.getId());
                change = insertChange(userId, operation.entityId(), ChangeOperation.DELETE, note.getVersion());
                result = SyncOperationResult.applied(operation.idempotencyKey(), notesService.toDto(note));
            }
        } else if (current == null) {
            if (operation.baseVersion() != null && operation.baseVersion() != 0) {
                result = SyncOperationResult.conflict(operation.idempotencyKey(), null, "服务端不存在该便签");
            } else {
                Payload payload = parsePayload(operation.payload());
                NoteEntity note = new NoteEntity();
                note.setId(operation.entityId());
                note.setUserId(userId);
                note.setTitle(payload.title);
                note.setContent(writeJson(payload.content));
                note.setPlainText(NoteContent.normalizePlainText(payload.content));
                note.setIsPinned(payload.isPinned);
                note.setIsArchived(payload.isArchived);
                Instant now = Instant.now();
                note.setCreatedAt(now);
                note.setUpdatedAt(now);
                noteMapper.insert(note);
                notesService.replaceTags(userId, operation.entityId(), payload.tags);
                note = noteMapper.selectById(operation.entityId());
                change = insertChange(userId, operation.entityId(), ChangeOperation.UPSERT, note.getVersion());
                result = SyncOperationResult.applied(operation.idempotencyKey(), notesService.toDto(note));
            }
        } else if (!Objects.equals(operation.baseVersion(), current.getVersion())) {
            result = SyncOperationResult.conflict(operation.idempotencyKey(), notesService.toDto(current), "服务端版本更新");
        } else {
            Payload payload = parsePayload(operation.payload());
            UpdateWrapper<NoteEntity> update = new UpdateWrapper<>();
            update.eq("id", current.getId())
                    .set("title", payload.title)
                    .set("content", writeJson(payload.content))
                    .set("plain_text", NoteContent.normalizePlainText(payload.content))
                    .set("is_pinned", payload.isPinned)
                    .set("is_archived", payload.isArchived)
                    .set("deleted_at", null)
                    .set("version", current.getVersion() + 1)
                    .set("updated_at", Instant.now());
            noteMapper.update(null, update);
            notesService.replaceTags(userId, current.getId(), payload.tags);
            NoteEntity note = noteMapper.selectById(current.getId());
            change = insertChange(userId, operation.entityId(), ChangeOperation.UPSERT, note.getVersion());
            result = SyncOperationResult.applied(operation.idempotencyKey(), notesService.toDto(note));
        }

        MutationEntity mutation = new MutationEntity();
        mutation.setId(UUID.randomUUID().toString());
        mutation.setUserId(userId);
        mutation.setIdempotencyKey(operation.idempotencyKey());
        mutation.setResponse(writeJson(result));
        mutation.setCreatedAt(Instant.now());
        mutationMapper.insert(mutation);
        return new Applied(result, change);
    }

    private ChangeDto toChangeDto(Map<String, Object> row) {
        Object changedAt = row.get("changed_at");
        Instant instant = null;
        if (changedAt instanceof Timestamp timestamp) {
            instant = timestamp.toInstant();
        } else if (changedAt instanceof LocalDateTime local) {
            instant = local.toInstant(ZoneOffset.UTC);
        }
        return new ChangeDto(
                String.valueOf(row.get("cursor")),
                EntityType.valueOf(String.valueOf(row.get("entity_type"))),
                String.valueOf(row.get("entity_id")),
                ChangeOperation.valueOf(String.valueOf(row.get("operation"))),
                ((Number) row.get("version")).intValue(),
                instant);
    }

    private ChangeDto insertChange(String userId, String entityId, ChangeOperation operation, int version) {
        ChangeLogEntity change = ChangeLogEntity.of(userId, EntityType.NOTE, entityId, operation, version);
        changeLogMapper.insert(change);
        return NotesService.toChangeDto(change);
    }

    private record Payload(String title, Map<String, Object> content, List<String> tags, boolean isPinned, boolean isArchived) {
    }

    @SuppressWarnings("unchecked")
    private Payload parsePayload(Map<String, Object> payload) {
        Object titleValue = payload == null ? null : payload.get("title");
        String title = titleValue instanceof String s ? s.trim() : "";
        if (title.length() > 255) {
            title = title.substring(0, 255);
        }
        Object content = payload == null ? null : payload.get("content");
        if (!(content instanceof Map) || content instanceof List) {
            throw ApiException.badRequest("便签内容格式无效");
        }
        List<String> tags = new ArrayList<>();
        Object tagsValue = payload.get("tags");
        if (tagsValue instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof String tag) {
                    String normalized = tag.trim();
                    if (!normalized.isEmpty()) {
                        tags.add(normalized.length() > 64 ? normalized.substring(0, 64) : normalized);
                    }
                }
            }
        }
        List<String> distinct = tags.stream().distinct().toList();
        tags = distinct.size() > 20 ? distinct.subList(0, 20) : distinct;
        return new Payload(title, (Map<String, Object>) content, tags,
                Boolean.TRUE.equals(payload.get("isPinned")), Boolean.TRUE.equals(payload.get("isArchived")));
    }

    private SyncOperationResult readResult(String json) {
        try {
            return objectMapper.readValue(json, SyncOperationResult.class);
        } catch (Exception e) {
            throw ApiException.unavailable("同步记录读取失败");
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            throw ApiException.badRequest("数据格式无效");
        }
    }
}
