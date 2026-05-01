# Provenance

Complete creative lineage for AI-powered design.

## Stack

- **Web** — Next.js (App Router) + React Flow + Zustand
- **API** — NestJS + Socket.IO (`@nestjs/platform-socket.io`) + better-sqlite3
- **Shared** — `packages/shared` exports types, socket protocol, and the AI provider contract
- **AI** — pluggable provider registry (`anthropic` today, `gemini` later, `mock` for offline demo)

## Setup

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.local.example apps/web/.env.local
npm run build -w @provenance/shared
npm run dev
```

Web on http://localhost:3000, API on http://localhost:3001.

## Layout

```
apps/
  web/   Next.js client (canvas, ancestry/compare panels)
  api/   NestJS server (gateway, capture, ai, db)
packages/
  shared/  cross-cutting types + socket protocol
```
