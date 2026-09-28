package com.stickynotes.api.notes;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.UpdateWrapper;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.stickynotes.api.common.ApiException;
import com.stickynotes.api.common.NoteContent;
import com.stickynotes.api.contract.Dtos.ChangeDto;
import com.stickynotes.api.contract.Dtos.ChangeOperation;
import com.stickynotes.api.contract.Dtos.EntityType;
import com.stickynotes.api.contract.Dtos.NoteDto;
import com.stickynotes.api.contract.Dtos.TagDto;
import com.stickynotes.api.entity.ChangeLogEntity;
import com.stickynotes.api.entity.NoteEntity;
import com.stickynotes.api.entity.NoteShareEntity;
import com.stickynotes.api.entity.NoteTagEntity;
import com.stickynotes.api.entity.TagEntity;
import com.stickynotes.api.mapper.ChangeLogMapper;
import com.stickynotes.api.mapper.NoteMapper;
import com.stickynotes.api.mapper.NoteShareMapper;
import com.stickynotes.api.mapper.NoteTagMapper;
import com.stickynotes.api.mapper.TagMapper;
import com.stickynotes.api.realtime.RealtimeService;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HexFormat;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
public class NotesService {

    private final NoteMapper noteMapper;
    private final TagMapper tagMapper;
    private final NoteTagMapper noteTagMapper;
    private final NoteShareMapper shareMapper;
    private final ChangeLogMapper changeLogMapper;
    private final RealtimeService realtime;
    private final ObjectMapper objectMapper;
    private final SecureRandom secureRandom = new SecureRandom();

    public NotesService(NoteMapper noteMapper, TagMapper tagMapper, NoteTagMapper noteTagMapper,
                        NoteShareMapper shareMapper, ChangeLogMapper changeLogMapper,
                        RealtimeService realtime, ObjectMapper objectMapper) {
        this.noteMapper = noteMapper;
        this.tagMapper = tagMapper;
        this.noteTagMapper = noteTagMapper;
        this.shareMapper = shareMapper;
        this.changeLogMapper = changeLogMapper;
        this.realtime = realtime;
        this.objectMapper = objectMapper;
    }

    public List<NoteDto> list(String userId, String q, String tag, Boolean trash, Boolean archived) {
        QueryWrapper<NoteEntity> query = new QueryWrapper<>();
        query.eq("user_id", userId);
        if (Boolean.TRUE.equals(trash)) {
            query.isNotNull("deleted_at");
        } else {
            query.isNull("deleted_at");
        }
        if (archived != null) {
            query.eq("is_archived", archived);
        } else if (!Boolean.TRUE.equals(trash)) {
            query.eq("is_archived", false);
        }
        if (tag != null && !tag.isBlank()) {
            query.exists("SELECT 1 FROM note_tags nt JOIN tags t ON t.id = nt.tag_id WHERE nt.note_id = notes.id AND t.name = {0}", tag.trim());
        }
        String search = q == null ? "" : q.trim();
        if (!search.isEmpty()) {
            if (search.length() >= 2) {
                List<String> ids = noteMapper.searchIds(userId, search, Boolean.TRUE.equals(trash));
                if (ids.isEmpty()) {
                    return List.of();
                }
                query.in("id", ids);
            } else {
                query.and(w -> w.like("title", search).or().like("plain_text", search));
            }
        }
        query.orderByDesc("is_pinned").orderByDesc("updated_at").last("LIMIT 200");
        return toDtos(noteMapper.selectList(query));
    }

    public List<TagDto> listTags(String userId) {
        return tagMapper.selectList(new QueryWrapper<TagEntity>().eq("user_id", userId).orderByAsc("name"))
                .stream().map(tag -> new TagDto(tag.getId(), tag.getName(), tag.getColor())).toList();
    }

    public NoteDto get(String userId, String id) {
        NoteEntity note = findOwned(userId, id);
        return toDto(note);
    }

    @Transactional
    public NoteDto create(String userId, NoteDtos.CreateNoteRequest input) {
        NoteEntity note = new NoteEntity();
        note.setId(input.id() != null ? input.id() : UUID.randomUUID().toString());
        note.setUserId(userId);
        note.setTitle(input.title().trim());
        note.setContent(writeJson(input.content()));
        note.setPlainText(NoteContent.normalizePlainText(input.content()));
        note.setIsPinned(Boolean.TRUE.equals(input.isPinned()));
        note.setIsArchived(Boolean.TRUE.equals(input.isArchived()));
        Instant now = Instant.now();
        note.setCreatedAt(now);
        note.setUpdatedAt(now);
        noteMapper.insert(note);
        replaceTags(userId, note.getId(), input.tags() == null ? List.of() : input.tags());

        NoteDto dto = toDto(noteMapper.selectById(note.getId()));
        emit(userId, EntityType.NOTE, note.getId(), ChangeOperation.UPSERT, dto.version());
        return dto;
    }

    @Transactional
    public NoteDto update(String userId, String id, NoteDtos.UpdateNoteRequest input) {
        NoteEntity current = findOwned(userId, id);
        if (!Objects.equals(current.getVersion(), input.baseVersion())) {
            throw ApiException.conflict("便签已在其他设备更新");
        }
        UpdateWrapper<NoteEntity> update = new UpdateWrapper<>();
        update.eq("id", id).eq("user_id", userId).eq("version", input.baseVersion());
        update.set("version", current.getVersion() + 1).set("updated_at", Instant.now());
        if (input.title() != null) {
            update.set("title", input.title().trim());
        }
        if (input.content() != null) {
            update.set("content", writeJson(input.content()));
            update.set("plain_text", NoteContent.normalizePlainText(input.content()));
        }
        if (input.isPinned() != null) {
            update.set("is_pinned", input.isPinned());
        }
        if (input.isArchived() != null) {
            update.set("is_archived", input.isArchived());
        }
        if (noteMapper.update(null, update) != 1) {
            throw ApiException.conflict("便签已在其他设备更新");
        }
        if (input.tags() != null) {
            replaceTags(userId, id, input.tags());
        }
        NoteDto dto = toDto(noteMapper.selectById(id));
        emit(userId, EntityType.NOTE, id, ChangeOperation.UPSERT, dto.version());
        return dto;
    }

    @Transactional
    public void softDelete(String userId, String id, Integer baseVersion) {
        setDeletedState(userId, id, true, baseVersion);
    }

    @Transactional
    public NoteDto restore(String userId, String id, int baseVersion) {
        return setDeletedState(userId, id, false, baseVersion);
    }

    @Transactional
    public void permanentlyDelete(String userId, String id) {
        NoteEntity note = noteMapper.selectOne(new QueryWrapper<NoteEntity>()
                .eq("id", id).eq("user_id", userId).isNotNull("deleted_at").last("LIMIT 1"));
        if (note == null) {
            throw ApiException.notFound("回收站中不存在该便签");
        }
        noteMapper.deleteById(id);
        emit(userId, EntityType.NOTE, id, ChangeOperation.DELETE, note.getVersion() + 1);
    }

    public NoteDtos.ShareCreatedResponse createShare(String userId, String noteId, NoteDtos.ShareNoteRequest input) {
        findOwnedActive(userId, noteId);
        Instant expiresAt = input.expiresAt() == null || input.expiresAt().isBlank() ? null : Instant.parse(input.expiresAt());
        if (expiresAt != null && !expiresAt.isAfter(Instant.now())) {
            throw ApiException.conflict("过期时间必须晚于当前时间");
        }
        byte[] bytes = new byte[32];
        secureRandom.nextBytes(bytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);

        NoteShareEntity share = new NoteShareEntity();
        share.setId(UUID.randomUUID().toString());
        share.setNoteId(noteId);
        share.setTokenHash(hashToken(token));
        share.setExpiresAt(expiresAt);
        share.setCreatedAt(Instant.now());
        shareMapper.insert(share);
        return new NoteDtos.ShareCreatedResponse(token, expiresAt == null ? null : expiresAt.toString());
    }

    @Transactional
    public void revokeShares(String userId, String noteId) {
        findOwned(userId, noteId);
        UpdateWrapper<NoteShareEntity> update = new UpdateWrapper<>();
        update.eq("note_id", noteId).isNull("revoked_at").set("revoked_at", Instant.now());
        shareMapper.update(null, update);
    }

    public NoteDto getShared(String token) {
        NoteShareEntity share = shareMapper.selectOne(new QueryWrapper<NoteShareEntity>()
                .eq("token_hash", hashToken(token))
                .isNull("revoked_at")
                .and(w -> w.isNull("expires_at").or().gt("expires_at", Instant.now()))
                .last("LIMIT 1"));
        if (share == null) {
            throw ApiException.notFound("分享链接不存在或已失效");
        }
        NoteEntity note = noteMapper.selectById(share.getNoteId());
        if (note == null || note.getDeletedAt() != null) {
            throw ApiException.notFound("分享链接不存在或已失效");
        }
        return toDto(note);
    }

    @Transactional
    public NoteDto setDeletedState(String userId, String id, boolean deleted, Integer baseVersion) {
        NoteEntity current = findOwned(userId, id);
        if (baseVersion != null && !Objects.equals(current.getVersion(), baseVersion)) {
            throw ApiException.conflict("便签已在其他设备更新");
        }
        UpdateWrapper<NoteEntity> update = new UpdateWrapper<>();
        update.eq("id", id)
                .set("deleted_at", deleted ? Instant.now() : null)
                .set("version", current.getVersion() + 1)
                .set("updated_at", Instant.now());
        noteMapper.update(null, update);
        NoteDto dto = toDto(noteMapper.selectById(id));
        emit(userId, EntityType.NOTE, id, deleted ? ChangeOperation.DELETE : ChangeOperation.UPSERT, dto.version());
        return dto;
    }

    public NoteEntity findOwned(String userId, String id) {
        NoteEntity note = noteMapper.selectOne(new QueryWrapper<NoteEntity>()
                .eq("id", id).eq("user_id", userId).last("LIMIT 1"));
        if (note == null) {
            throw ApiException.notFound("便签不存在");
        }
        return note;
    }

    public NoteEntity findOwnedActive(String userId, String id) {
        NoteEntity note = noteMapper.selectOne(new QueryWrapper<NoteEntity>()
                .eq("id", id).eq("user_id", userId).isNull("deleted_at").last("LIMIT 1"));
        if (note == null) {
            throw ApiException.notFound("便签不存在");
        }
        return note;
    }

    public void replaceTags(String userId, String noteId, List<String> names) {
        List<String> distinct = names.stream().map(String::trim).filter(s -> !s.isEmpty()).distinct().toList();
        List<String> normalized = distinct.size() > 20 ? distinct.subList(0, 20) : distinct;
        List<String> tagIds = new ArrayList<>();
        for (String name : normalized) {
            TagEntity tag = tagMapper.selectOne(new QueryWrapper<TagEntity>()
                    .eq("user_id", userId).eq("name", name).last("LIMIT 1"));
            if (tag == null) {
                tag = TagEntity.of(userId, name);
                try {
                    tagMapper.insert(tag);
                } catch (DuplicateKeyException e) {
                    tag = tagMapper.selectOne(new QueryWrapper<TagEntity>()
                            .eq("user_id", userId).eq("name", name).last("LIMIT 1"));
                }
            }
            tagIds.add(tag.getId());
        }
        noteTagMapper.delete(new QueryWrapper<NoteTagEntity>().eq("note_id", noteId));
        for (String tagId : tagIds) {
            noteTagMapper.insert(new NoteTagEntity(noteId, tagId));
        }
    }

    public void emit(String userId, EntityType type, String entityId, ChangeOperation operation, int version) {
        ChangeLogEntity change = ChangeLogEntity.of(userId, type, entityId, operation, version);
        changeLogMapper.insert(change);
        realtime.emitChange(userId, toChangeDto(change));
    }

    public static ChangeDto toChangeDto(ChangeLogEntity change) {
        return new ChangeDto(String.valueOf(change.getCursor()), change.getEntityType(), change.getEntityId(),
                change.getOperation(), change.getVersion(), change.getChangedAt());
    }

    public List<NoteDto> toDtos(List<NoteEntity> notes) {
        if (notes.isEmpty()) {
            return List.of();
        }
        Map<String, List<TagDto>> tagsByNote = new java.util.HashMap<>();
        List<String> ids = notes.stream().map(NoteEntity::getId).toList();
        for (Map<String, Object> row : tagMapper.selectByNoteIds(ids)) {
            TagDto tag = new TagDto(String.valueOf(row.get("id")), String.valueOf(row.get("name")), String.valueOf(row.get("color")));
            tagsByNote.computeIfAbsent(String.valueOf(row.get("noteId")), k -> new ArrayList<>()).add(tag);
        }
        return notes.stream().map(note -> toDto(note, tagsByNote.getOrDefault(note.getId(), List.of()))).toList();
    }

    public NoteDto toDto(NoteEntity note) {
        return toDto(note, tagsOf(note.getId()));
    }

    private List<TagDto> tagsOf(String noteId) {
        return tagMapper.selectByNoteIds(List.of(noteId)).stream()
                .map(row -> new TagDto(String.valueOf(row.get("id")), String.valueOf(row.get("name")), String.valueOf(row.get("color"))))
                .toList();
    }

    private NoteDto toDto(NoteEntity note, List<TagDto> tags) {
        return new NoteDto(note.getId(), note.getTitle(), readJson(note.getContent()), note.getPlainText(),
                Boolean.TRUE.equals(note.getIsPinned()), Boolean.TRUE.equals(note.getIsArchived()),
                note.getDeletedAt(), note.getVersion() == null ? 1 : note.getVersion(), tags,
                note.getCreatedAt(), note.getUpdatedAt());
    }

    private Map<String, Object> readJson(String json) {
        try {
            return objectMapper.readValue(json, new TypeReference<>() {
            });
        } catch (Exception e) {
            return Map.of();
        }
    }

    private String writeJson(Map<String, Object> content) {
        try {
            return objectMapper.writeValueAsString(content);
        } catch (Exception e) {
            throw ApiException.badRequest("便签内容格式无效");
        }
    }

    private String hashToken(String token) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
