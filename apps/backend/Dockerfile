# syntax=docker/dockerfile:1.6
# ---- Build stage ----
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /workspace

COPY pom.xml .
COPY src ./src

# One Maven invocation (go-offline was fragile on flaky networks: if it died mid-download the
# whole build failed, even though `package` would retry naturally). The cache mount persists
# ~/.m2 across builds so a retry picks up where the previous run left off instead of starting
# over. Retry/timeout flags are belt-and-braces for Maven Central hiccups.
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B \
        -Dmaven.wagon.http.retryHandler.count=5 \
        -Dmaven.wagon.http.retryHandler.requestSentEnabled=true \
        -Dmaven.wagon.httpconnectionManager.ttlSeconds=120 \
        -Dmaven.wagon.http.readTimeout=180000 \
        -Dmaven.wagon.http.connectionTimeout=60000 \
        clean package -DskipTests

# ---- Runtime stage ----
FROM eclipse-temurin:21-jre
WORKDIR /app

RUN groupadd --system app && useradd --system --gid app --no-create-home app \
    && mkdir -p /app/uploads \
    && chown -R app:app /app

COPY --from=build --chown=app:app /workspace/target/*.jar /app/app.jar
USER app

EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
