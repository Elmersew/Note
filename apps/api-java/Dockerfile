FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY apps/api-java/pom.xml ./
RUN mvn -B -q dependency:go-offline
COPY apps/api-java/src ./src
RUN mvn -B -q package -DskipTests

FROM eclipse-temurin:17-jre-noble
ENV API_PORT=3001
ENV SOCKET_IO_PORT=3002
WORKDIR /app
RUN groupadd -r app && useradd -r -g app app
COPY --from=build --chown=app:app /app/target/sticky-notes-api.jar app.jar
USER app
EXPOSE 3001 3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 CMD ["bash", "-c", "exec 3<>/dev/tcp/127.0.0.1/3001 && printf 'GET /api/health HTTP/1.0\\r\\n\\r\\n' >&3 && grep -q 'ok' <&3"]
CMD ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
