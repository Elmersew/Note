# Project commands

- Install dependencies: `npx --yes pnpm@10.17.1 install`
- Start Web (Next.js): `npx --yes pnpm@10.17.1 dev`
- Type-check all packages: `npx --yes pnpm@10.17.1 typecheck`
- Run all tests: `npx --yes pnpm@10.17.1 test`
- Build all packages: `npx --yes pnpm@10.17.1 build`
- Build API (Spring Boot): `mvn -f apps/api-java -B package -DskipTests` or `npm run api:build`
- Start API locally: `mvn -f apps/api-java spring-boot:run` or `npm run api:dev`
- Build production images locally: `docker compose -f compose.prod.yaml build`
- Pull published production images: `docker compose -f compose.prod.yaml pull`
- Start production containers: `docker compose -f compose.prod.yaml up -d --no-build`
- Check production containers: `docker compose -f compose.prod.yaml ps`

The Web app runs at `http://localhost:3000`, the API (Spring Boot 3 + MyBatis-Plus, JDK 17) runs at `http://localhost:3001/api`, Socket.IO realtime runs on port `3002`, and API documentation is available at `http://localhost:3001/api/docs`. Runtime configuration is loaded from the ignored root `.env` file (`DATABASE_URL`/`JWT_SECRET`/`WEB_ORIGIN`/`COOKIE_SECURE`/`SOCKET_IO_PORT`/`AI_*`). MySQL 8.4 uses the `sticky_notes` database and the initialization script is under `database/migrations/20260926000000_init/migration.sql`. `WEB_ORIGIN="*"` reflects any request origin (used for Cloudflare quick tunnels).
