package com.stickynotes.api.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(
            @Email @Size(max = 191) String email,
            @Pattern(regexp = "^\\+?[1-9]\\d{6,14}$") String phone,
            @NotBlank @Size(min = 8, max = 72) String password,
            @NotBlank @Size(min = 1, max = 80) String displayName) {
    }

    public record LoginRequest(
            @NotBlank @Size(min = 3, max = 191) String identifier,
            @NotBlank @Size(min = 8, max = 72) String password) {
    }
}
