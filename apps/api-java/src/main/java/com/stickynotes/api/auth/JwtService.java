package com.stickynotes.api.auth;

import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import com.stickynotes.api.config.AppProperties;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;

@Service
public class JwtService {

    private final SecretKey key;

    public JwtService(AppProperties properties) {
        byte[] secret = properties.getJwtSecret().getBytes(StandardCharsets.UTF_8);
        this.key = Keys.hmacShaKeyFor(secret.length >= 32 ? secret : pad(secret));
    }

    public String issue(String userId) {
        return Jwts.builder().subject(userId).signWith(key).compact();
    }

    /** 校验失败返回 null。 */
    public String verify(String token) {
        try {
            return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload().getSubject();
        } catch (JwtException | IllegalArgumentException e) {
            return null;
        }
    }

    private static byte[] pad(byte[] secret) {
        byte[] padded = new byte[32];
        System.arraycopy(secret, 0, padded, 0, Math.min(secret.length, 32));
        return padded;
    }
}
