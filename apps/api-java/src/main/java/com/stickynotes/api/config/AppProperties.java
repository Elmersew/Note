package com.stickynotes.api.config;

import jakarta.annotation.PostConstruct;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

import java.util.Arrays;
import java.util.List;

@Configuration
@ConfigurationProperties(prefix = "app")
public class AppProperties {

    private String databaseUrl = "";
    private String jwtSecret = "";
    private String webOrigin = "http://localhost:3000";
    private boolean cookieSecure = false;
    private int socketIoPort = 3002;
    private String aiBaseUrl = "https://api.openai.com/v1";
    private String aiApiKey = "";
    private String aiModel = "";

    @PostConstruct
    void validate() {
        if (!databaseUrl.startsWith("mysql://")) {
            throw new IllegalStateException("DATABASE_URL must be a MySQL connection URL");
        }
        if (jwtSecret.length() < 32) {
            throw new IllegalStateException("JWT_SECRET must contain at least 32 characters");
        }
    }

    /** null 表示允许任意来源（回显 Origin），否则返回白名单。 */
    public List<String> corsOrigins() {
        if ("*".equals(webOrigin.trim())) {
            return null;
        }
        return Arrays.stream(webOrigin.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    }

    public String getDatabaseUrl() {
        return databaseUrl;
    }

    public void setDatabaseUrl(String databaseUrl) {
        this.databaseUrl = databaseUrl;
    }

    public String getJwtSecret() {
        return jwtSecret;
    }

    public void setJwtSecret(String jwtSecret) {
        this.jwtSecret = jwtSecret;
    }

    public String getWebOrigin() {
        return webOrigin;
    }

    public void setWebOrigin(String webOrigin) {
        this.webOrigin = webOrigin;
    }

    public boolean isCookieSecure() {
        return cookieSecure;
    }

    public void setCookieSecure(boolean cookieSecure) {
        this.cookieSecure = cookieSecure;
    }

    public int getSocketIoPort() {
        return socketIoPort;
    }

    public void setSocketIoPort(int socketIoPort) {
        this.socketIoPort = socketIoPort;
    }

    public String getAiBaseUrl() {
        return aiBaseUrl;
    }

    public void setAiBaseUrl(String aiBaseUrl) {
        this.aiBaseUrl = aiBaseUrl;
    }

    public String getAiApiKey() {
        return aiApiKey;
    }

    public void setAiApiKey(String aiApiKey) {
        this.aiApiKey = aiApiKey;
    }

    public String getAiModel() {
        return aiModel;
    }

    public void setAiModel(String aiModel) {
        this.aiModel = aiModel;
    }
}
