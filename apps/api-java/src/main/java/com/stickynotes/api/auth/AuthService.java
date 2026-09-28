package com.stickynotes.api.auth;

import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;
import com.stickynotes.api.common.ApiException;
import com.stickynotes.api.contract.Dtos.SessionUser;
import com.stickynotes.api.entity.UserEntity;
import com.stickynotes.api.mapper.UserMapper;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.UUID;

@Service
public class AuthService {

    public static final String SESSION_COOKIE = "sticky_session";
    public static final long SESSION_MAX_AGE_MS = 7L * 24 * 60 * 60 * 1000;
    public static final String USER_ATTRIBUTE = "sessionUser";

    private final UserMapper userMapper;
    private final JwtService jwtService;
    private final BCryptPasswordEncoder passwordEncoder = new BCryptPasswordEncoder(12);

    public AuthService(UserMapper userMapper, JwtService jwtService) {
        this.userMapper = userMapper;
        this.jwtService = jwtService;
    }

    public record AuthResult(SessionUser user, String token) {
    }

    public AuthResult register(AuthDtos.RegisterRequest input) {
        String email = input.email() == null || input.email().isBlank() ? null : input.email().trim().toLowerCase();
        String phone = input.phone() == null || input.phone().isBlank() ? null : input.phone().trim();
        if (email == null && phone == null) {
            throw ApiException.conflict("邮箱或手机号至少填写一项");
        }
        UserEntity user = new UserEntity();
        user.setId(UUID.randomUUID().toString());
        user.setEmail(email);
        user.setPhone(phone);
        user.setDisplayName(input.displayName().trim());
        user.setPasswordHash(passwordEncoder.encode(input.password()));
        Instant now = Instant.now();
        user.setCreatedAt(now);
        user.setUpdatedAt(now);
        try {
            userMapper.insert(user);
        } catch (DuplicateKeyException e) {
            throw ApiException.conflict("邮箱或手机号已被注册");
        }
        return new AuthResult(toSessionUser(user), jwtService.issue(user.getId()));
    }

    public AuthResult login(AuthDtos.LoginRequest input) {
        String identifier = input.identifier().trim().toLowerCase();
        UserEntity user = userMapper.selectOne(new QueryWrapper<UserEntity>()
                .eq(identifier.contains("@") ? "email" : "phone", identifier)
                .last("LIMIT 1"));
        if (user == null || !passwordEncoder.matches(input.password(), user.getPasswordHash())) {
            throw ApiException.unauthorized("账号或密码错误");
        }
        return new AuthResult(toSessionUser(user), jwtService.issue(user.getId()));
    }

    public SessionUser resolveSession(String token) {
        String userId = jwtService.verify(token);
        if (userId == null) {
            return null;
        }
        UserEntity user = userMapper.selectById(userId);
        return user == null ? null : toSessionUser(user);
    }

    private SessionUser toSessionUser(UserEntity user) {
        return new SessionUser(user.getId(), user.getEmail(), user.getPhone(), user.getDisplayName());
    }
}
