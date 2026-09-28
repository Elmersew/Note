package com.stickynotes.api.realtime;

import com.corundumstudio.socketio.SocketIOServer;
import com.stickynotes.api.auth.AuthService;
import com.stickynotes.api.auth.JwtService;
import com.stickynotes.api.config.AppProperties;
import com.stickynotes.api.contract.Dtos.ChangeDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class RealtimeService {

    private final SocketIOServer server;

    public RealtimeService(SocketIOServer server) {
        this.server = server;
    }

    public void emitChange(String userId, ChangeDto change) {
        if (server == null) {
            return;
        }
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("cursor", change.cursor());
        payload.put("entityType", change.entityType().name());
        payload.put("entityId", change.entityId());
        payload.put("operation", change.operation().name());
        payload.put("version", change.version());
        payload.put("changedAt", change.changedAt().toString());
        try {
            server.getRoomOperations(room(userId)).sendEvent("change", payload);
        } catch (Exception e) {
            LoggerFactory.getLogger(RealtimeService.class).warn("实时推送失败: {}", e.getMessage());
        }
    }

    private static String room(String userId) {
        return "user:" + userId;
    }

    @Configuration
    static class SocketIoConfig {

        private static final Logger log = LoggerFactory.getLogger(SocketIoConfig.class);

        @Bean(destroyMethod = "stop")
        SocketIOServer socketIOServer(AppProperties properties, JwtService jwtService) {
            com.corundumstudio.socketio.Configuration config = new com.corundumstudio.socketio.Configuration();
            config.setHostname("0.0.0.0");
            config.setPort(properties.getSocketIoPort());
            config.setContext("/socket.io");
            config.setAllowCustomRequests(true);

            SocketIOServer server = new SocketIOServer(config);
            server.addConnectListener(client -> {
                String token = readCookie(client.getHandshakeData().getHttpHeaders().get("cookie"), AuthService.SESSION_COOKIE);
                String userId = token == null ? null : jwtService.verify(token);
                if (userId == null) {
                    log.warn("Rejected unauthenticated socket {}", client.getSessionId());
                    client.disconnect();
                    return;
                }
                client.joinRoom(room(userId));
            });
            server.start();
            return server;
        }

        private static String readCookie(String header, String name) {
            if (header == null) {
                return null;
            }
            for (String item : header.split(";")) {
                String[] pair = item.trim().split("=", 2);
                if (pair.length == 2 && name.equals(pair[0])) {
                    return java.net.URLDecoder.decode(pair[1], java.nio.charset.StandardCharsets.UTF_8);
                }
            }
            return null;
        }
    }
}
