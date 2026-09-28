package com.stickynotes.api.config;

import com.zaxxer.hikari.HikariDataSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import javax.sql.DataSource;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;

@Configuration
public class DataSourceConfig {

    /** 将 mysql://user:pass@host:port/db?params 解析为 JDBC 数据源。 */
    @Bean
    public DataSource dataSource(AppProperties properties) {
        URI uri = URI.create(properties.getDatabaseUrl());
        String userInfo = uri.getRawUserInfo() == null ? "" : uri.getRawUserInfo();
        int separator = userInfo.indexOf(':');
        String user = separator >= 0 ? userInfo.substring(0, separator) : userInfo;
        String password = separator >= 0 ? userInfo.substring(separator + 1) : "";

        StringBuilder jdbc = new StringBuilder("jdbc:mysql://")
                .append(uri.getHost() == null ? "127.0.0.1" : uri.getHost())
                .append(uri.getPort() > 0 ? ":" + uri.getPort() : ":3306")
                .append(uri.getPath() == null ? "" : uri.getPath())
                .append(uri.getRawQuery() == null ? "?" : "?" + uri.getRawQuery() + "&")
                .append("useUnicode=true&characterEncoding=UTF-8&connectionTimeZone=UTC");

        HikariDataSource dataSource = new HikariDataSource();
        dataSource.setJdbcUrl(jdbc.toString());
        dataSource.setUsername(URLDecoder.decode(user, StandardCharsets.UTF_8));
        dataSource.setPassword(URLDecoder.decode(password, StandardCharsets.UTF_8));
        dataSource.setMaximumPoolSize(10);
        dataSource.setPoolName("sticky-notes");
        return dataSource;
    }

    @Bean
    public TransactionTemplate transactionTemplate(PlatformTransactionManager transactionManager) {
        return new TransactionTemplate(transactionManager);
    }
}
