package com.stickynotes.api.ai;

import com.stickynotes.api.contract.Dtos.AiOperation;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AiDtos {

    private static final String UUID_PATTERN = "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";

    private AiDtos() {
    }

    public record AiTransformRequest(
            @NotNull AiOperation operation,
            @NotBlank @Pattern(regexp = UUID_PATTERN) String noteId,
            @Size(max = 30_000) String selectedText) {
    }

    public record AiAskRequest(
            @NotBlank @Pattern(regexp = UUID_PATTERN) String noteId,
            @NotBlank @Size(min = 1, max = 2_000) String question) {
    }
}
