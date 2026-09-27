# Project commands

- Install dependencies: `npx --yes pnpm@10.17.1 install`
- Generate Prisma Client: `npx --yes pnpm@10.17.1 --filter @sticky-notes/api prisma:generate`
- Start Web and API: `npx --yes pnpm@10.17.1 dev`
- Type-check all packages: `npx --yes pnpm@10.17.1 typecheck`
- Run all tests: `npx --yes pnpm@10.17.1 test`
- Build all packages: `npx --yes pnpm@10.17.1 build`
- Build production images locally: `docker compose -f compose.prod.yaml build`
- Pull published production images: `docker compose -f compose.prod.yaml pull`
- Start production containers: `docker compose -f compose.prod.yaml up -d --no-build`
- Check production containers: `docker compose -f compose.prod.yaml ps`

The Web app runs at `http://localhost:3000`, the API runs at `http://localhost:3001/api`, and API documentation is available at `http://localhost:3001/api/docs`. Runtime configuration is loaded from the ignored root `.env` file. MySQL 8.4 uses the `sticky_notes` database and the initialization script is under `apps/api/prisma/migrations/20260926000000_init/migration.sql`.
