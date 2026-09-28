package com.stickynotes.api.auth;

import com.stickynotes.api.common.ApiException;
import com.stickynotes.api.contract.Dtos.SessionUser;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class AuthInterceptor implements HandlerInterceptor {

    private final AuthService authService;

    public AuthInterceptor(AuthService authService) {
        this.authService = authService;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        String token = readCookie(request, AuthService.SESSION_COOKIE);
        if (token == null) {
            throw ApiException.unauthorized("请先登录");
        }
        SessionUser user = authService.resolveSession(token);
        if (user == null) {
            throw ApiException.unauthorized("登录状态已失效");
        }
        request.setAttribute(AuthService.USER_ATTRIBUTE, user);
        return true;
    }

    public static SessionUser currentUser(HttpServletRequest request) {
        return (SessionUser) request.getAttribute(AuthService.USER_ATTRIBUTE);
    }

    private static String readCookie(HttpServletRequest request, String name) {
        Cookie[] cookies = request.getCookies();
        if (cookies == null) {
            return null;
        }
        for (Cookie cookie : cookies) {
            if (name.equals(cookie.getName())) {
                return cookie.getValue();
            }
        }
        return null;
    }
}
