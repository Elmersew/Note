package com.stickynotes.api;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication(exclude = DataSourceAutoConfiguration.class)
@ConfigurationPropertiesScan
@MapperScan("com.stickynotes.api.mapper")
public class StickyNotesApplication {

    public static void main(String[] args) {
        SpringApplication.run(StickyNotesApplication.class, args);
    }
}
