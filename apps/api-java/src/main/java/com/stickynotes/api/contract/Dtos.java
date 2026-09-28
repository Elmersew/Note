package com.stickynotes.api.contract;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public final class Dtos {

    private Dtos() {
    }

    public record SessionUser(String id, String email, String phone, String displayName) {
    }

    public record TagDto(String id, String name, String color) {
    }

    public record NoteDto(
            String id,
            String title,
            Map<String, Object> content,
            String plainText,
            boolean isPinned,
            boolean isArchived,
            Instant deletedAt,
            int version,
            List<TagDto> tags,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record TaskDto(
            String id,
            String title,
            String description,
            TaskStatus status,
            TaskPriority priority,
            Instant dueAt,
            String sourceNoteId,
            int version,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record CalendarEventDto(
            String id,
            String title,
            String description,
            Instant startsAt,
            Instant endsAt,
            String timezone,
            boolean isAllDay,
            String location,
            String sourceNoteId,
            int version,
            Instant createdAt,
            Instant updatedAt) {
    }

    public record ChangeDto(
            String cursor,
            EntityType entityType,
            String entityId,
            ChangeOperation operation,
            int version,
            Instant changedAt) {
    }

    public record SyncOperationResult(
            String idempotencyKey,
            String status,
            Object entity,
            String message) {

        public static SyncOperationResult applied(String key, Object entity) {
            return new SyncOperationResult(key, "applied", entity, null);
        }

        public static SyncOperationResult conflict(String key, Object entity, String message) {
            return new SyncOperationResult(key, "conflict", entity, message);
        }

        public static SyncOperationResult failed(String key, String message) {
            return new SyncOperationResult(key, "failed", null, message);
        }
    }

    public record SyncPullResponse(String cursor, List<ChangeDto> changes) {
    }

    public record AiResult(String content, List<String> suggestedTags) {
    }

    public enum EntityType {
        NOTE, TASK, EVENT
    }

    public enum ChangeOperation {
        UPSERT, DELETE
    }

    public enum TaskStatus {
        TODO, IN_PROGRESS, DONE
    }

    public enum TaskPriority {
        LOW, MEDIUM, HIGH
    }

    public enum AiOperation {
        POLISH, SUMMARIZE, CONTINUE, KEY_POINTS, CLASSIFY
    }
}
