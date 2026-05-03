# Provenance

Complete creative lineage for AI-powered design.

Provenance silently captures the complete workflow lineage of every AI generation, making it possible to ask "how was this output made?" for any node on the canvas, at any time.

## Quick Start

```bash
npm install
npm run build -w @provenance/shared
npm run dev
```

Web on http://localhost:3000, API on http://localhost:3001.

Open two browser tabs to the same project URL to see live collaboration.

## Environment Variables

| Variable | Location | Required | Description |
|----------|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | `apps/api/.env` | No | Enables real Claude generation. Without it, a mock fallback provides canned responses. |
| `DB_PATH` | `apps/api/.env` | No | SQLite database path. Defaults to `./data/provenance.db`. |
| `NEXT_PUBLIC_API_URL` | `apps/web/.env.local` | No | API server URL. Defaults to `http://localhost:3001`. |

## Architecture

```
provenance/
├── apps/
│   ├── web/                    Next.js App Router (port 3000)
│   │   ├── components/
│   │   │   ├── CanvasShell     React Flow canvas with live collab
│   │   │   ├── NodeTypes/      5 custom nodes (TextPrompt, ImageRef, StyleMod, AiModel, Output)
│   │   │   ├── AncestryPanel   Right-side lineage viewer
│   │   │   ├── CompareOverlay  Graph-diff visualization
│   │   │   ├── Cursors         Live cursor rendering
│   │   │   └── TopBar/Left/Bot UI chrome
│   │   ├── store/useWorkflow   Zustand state (workflow, presence, undo, compare)
│   │   └── lib/                Socket.IO client, identity, API helpers
│   └── api/                    NestJS (port 3001)
│       └── src/
│           ├── realtime/       WebSocket gateway (ops, cursors, generation)
│           ├── capture/        Lineage capture pipeline + upstream BFS
│           ├── ai/             Anthropic SDK wrapper + mock fallback
│           └── db/             SQLite (better-sqlite3), workflow persistence
└── packages/
    └── shared/                 Types, socket events, graph-diff algorithm
```

## How It Works

1. **Canvas** — Architects build node-based AI workflows on a React Flow canvas with real-time multi-user collaboration via Socket.IO.

2. **Capture** — Every time an AI generation fires, the system walks the upstream graph (BFS from the AI node along reverse edges), captures the full subgraph + parameters, and stores it as a Lineage record in SQLite. The architect never sees this happen.

3. **Ancestry** — Click the ancestry chip on any output node to see the exact workflow that produced it. Restore any past workflow with one click.

4. **Comparison** — Select two generations to see a graph-aware diff: added (green), modified (amber), removed (red) nodes with field-level change details.

5. **Persistence** — Workflows are checkpointed to SQLite every 5 operations and after every generation. Kill the server, restart, and the canvas comes back.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Delete` / `Backspace` | Remove selected nodes |
| `Cmd+Z` / `Ctrl+Z` | Undo last deletion |
| `Escape` | Exit compare mode / deselect |

## Stack

- **Frontend** — Next.js 14 (App Router), React Flow, Zustand, Socket.IO Client
- **Backend** — NestJS, Socket.IO (`@nestjs/platform-socket.io`), better-sqlite3
- **AI** — Anthropic Claude API (mock fallback for offline)
- **Shared** — TypeScript types, graph-diff engine

## Scripts

```bash
npm run dev        # Start web + api concurrently
npm run build      # Build all packages
npm run typecheck  # Type-check all workspaces
```
