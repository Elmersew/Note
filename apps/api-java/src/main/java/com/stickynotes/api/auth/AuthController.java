package com.stickynotes.api.auth;

import com.stickynotes.api.config.AppProperties;
import com.stickynotes.api.contract.Dtos.SessionUser;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.Map;

@Tag(name = "auth")
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final AppProperties properties;

    public AuthController(AuthService authService, AppProperties properties) {
        this.authService = authService;
        this.properties = properties;
    }

    @PostMapping("/register")
    public Map<String, SessionUser> register(@Valid @RequestBody AuthDtos.RegisterRequest input, HttpServletResponse response) {
        AuthService.AuthResult result = authService.register(input);
        writeSessionCookie(response, result.token());
        return Map.of("user", result.user());
    }

    @PostMapping("/login")
    public Map<String, SessionUser> login(@Valid @RequestBody AuthDtos.LoginRequest input, HttpServletResponse response) {
        AuthService.AuthResult result = authService.login(input);
        writeSessionCookie(response, result.token());
        return Map.of("user", result.user());
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(HttpServletResponse response) {
        ResponseCookie cookie = baseCookie("").maxAge(Duration.ZERO).build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    public Map<String, SessionUser> me(HttpServletRequest request) {
        return Map.of("user", (SessionUser) request.getAttribute(AuthService.USER_ATTRIBUTE));
    }

    private void writeSessionCookie(HttpServletResponse response, String token) {
        ResponseCookie cookie = baseCookie(token).maxAge(Duration.ofMillis(AuthService.SESSION_MAX_AGE_MS)).build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private ResponseCookie.ResponseCookieBuilder baseCookie(String value) {
        return ResponseCookie.from(AuthService.SESSION_COOKIE, value)
                .httpOnly(true)
                .secure(properties.isCookieSecure())
                .sameSite("Lax")
                .path("/");
    }
}
