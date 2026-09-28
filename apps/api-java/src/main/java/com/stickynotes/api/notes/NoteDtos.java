package com.stickynotes.api.notes;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.Map;

public final class NoteDtos {

    private static final String UUID_PATTERN = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";

    private NoteDtos() {
    }

    public record CreateNoteRequest(
            @Pattern(regexp = UUID_PATTERN) String id,
            @NotNull @Size(max = 255) String title,
            @NotNull Map<String, Object> content,
            Boolean isPinned,
            Boolean isArchived,
            @Size(max = 20) List<@Size(max = 64) String> tags) {
    }

    public record UpdateNoteRequest(
            @NotNull @Min(1) Integer baseVersion,
            @Size(max = 255) String title,
            Map<String, Object> content,
            Boolean isPinned,
            Boolean isArchived,
            @Size(max = 20) List<@Size(max = 64) String> tags) {
    }

    public record NoteVersionRequest(@NotNull @Min(1) Integer baseVersion) {
    }

    public record ShareNoteRequest(String expiresAt) {
    }

    public record ShareCreatedResponse(String token, String expiresAt) {
    }
}
