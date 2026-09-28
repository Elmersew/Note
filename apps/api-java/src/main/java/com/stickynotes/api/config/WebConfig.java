package com.stickynotes.api.config;

import com.stickynotes.api.auth.AuthInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

@Configuration
public class WebConfig implements WebMvcConfigurer {

    private final AppProperties properties;
    private final AuthInterceptor authInterceptor;

    public WebConfig(AppProperties properties, AuthInterceptor authInterceptor) {
        this.properties = properties;
        this.authInterceptor = authInterceptor;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        var mapping = registry.addMapping("/api/**")
                .allowedMethods("GET", "POST", "PATCH", "DELETE", "OPTIONS")
                .allowedHeaders("Content-Type", "X-Requested-With")
                .allowCredentials(true);
        List<String> origins = properties.corsOrigins();
        if (origins == null) {
            mapping.allowedOriginPatterns("*");
        } else {
            mapping.allowedOrigins(origins.toArray(new String[0]));
        }
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(authInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns(
                        "/api/health",
                        "/api/auth/register",
                        "/api/auth/login",
                        "/api/auth/logout",
                        "/api/shares/**",
                        "/api/docs",
                        "/api/docs/**");
    }
}
