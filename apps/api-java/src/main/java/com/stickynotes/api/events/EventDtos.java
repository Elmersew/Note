package com.stickynotes.api.events;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class EventDtos {

    private static final String UUID_PATTERN = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";

    private EventDtos() {
    }

    public record CreateEventRequest(
            @Pattern(regexp = UUID_PATTERN) String id,
            @NotBlank @Size(max = 255) String title,
            @Size(max = 10_000) String description,
            @NotBlank String startsAt,
            @NotBlank String endsAt,
            @NotBlank @Size(max = 64) String timezone,
            Boolean isAllDay,
            @Size(max = 255) String location,
            @Pattern(regexp = UUID_PATTERN) String sourceNoteId) {
    }

    public record UpdateEventRequest(
            @NotNull @Min(1) Integer baseVersion,
            @Size(max = 255) String title,
            @Size(max = 10_000) String description,
            String startsAt,
            String endsAt,
            @Size(max = 64) String timezone,
            Boolean isAllDay,
            @Size(max = 255) String location) {
    }
}
