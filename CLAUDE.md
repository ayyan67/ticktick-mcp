# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run

```bash
npm run build          # TypeScript compilation (tsc)
npm start              # Run MCP server (node dist/index.js)
npm run auth           # Run OAuth flow to get tokens (node dist/auth.js)
```

No test framework is configured. Verify changes by building (`npm run build`) and testing interactively with `npx @modelcontextprotocol/inspector dist/index.js`.

## Architecture

This is an MCP server that exposes 20 tools for interacting with the TickTick API over stdio. Three runtime dependencies: `@modelcontextprotocol/sdk`, `zod`, `open`.

### Layer Structure

- **Entry point** (`index.ts`): Creates `McpServer`, instantiates `TickTickClient`, calls four `register*Tools()` functions, connects via `StdioServerTransport`. All logging goes to stderr.
- **HTTP client** (`client.ts`): Wraps native `fetch` with auto 401→refresh→retry logic. Reads auth from env vars. Methods: `get<T>`, `post<T>`, `delete`.
- **Tool modules** (`tools/*.ts`): Each exports a `register*Tools(server, client)` function. Four groups: projects (5 tools), tasks (6), batch (1), filters (8).
- **Auth** (`auth.ts`): Standalone CLI script (not imported by the server). OAuth2 browser flow bound to `127.0.0.1:8000` with CSRF state validation.

### Supporting Modules

- `types.ts`: Zod schemas + TS types for Task, Project, ProjectData, Subtask, BatchTaskRequest, OAuthTokens.
- `errors.ts`: `TickTickError` hierarchy (Auth/NotFound/RateLimit) + `handleToolError()` which converts any error to `{content, isError: true}` MCP response format.
- `dates.ts`: Handles TickTick's non-standard date format (`+0000` without colon). Uses `Intl.DateTimeFormat` for timezone-aware comparisons (`isToday`, `isOverdue`, `isThisWeek`).
- `format.ts`: `formatTask`/`formatProject`/`formatTaskList` produce structured text output with priority labels (`[HIGH]`/`[MED]`/`[LOW]`), readable dates, and subtask checkboxes.

### Key Design Decisions

- **Inbox handling**: TickTick's Inbox is not returned by `GET /project`. It's fetched separately via `GET /project/inbox/data` in the `fetchAllTasks()` helper in `filters.ts`.
- **Client-side filtering**: All filter tools (due today, overdue, search, etc.) fetch all tasks then filter in-memory. This enables cross-project queries and tolerates individual project fetch failures.
- **Conditional field serialization**: Create/update tools only include fields that were explicitly provided to avoid overwriting unset fields with nulls.
- **Every tool handler** wraps its body in try/catch + `handleToolError()`.

## Environment Variables

```
TICKTICK_ACCESS_TOKEN   # Required
TICKTICK_REFRESH_TOKEN  # Optional (for auto-refresh)
TICKTICK_CLIENT_ID      # Optional (for auto-refresh)
TICKTICK_CLIENT_SECRET  # Optional (for auto-refresh)
```

## TickTick API Notes

- Base URL: `https://api.ticktick.com/open/v1`
- Updates use POST (not PUT/PATCH): `POST /project/{id}`, `POST /task/{id}`
- Date format quirk: `2024-01-15T09:00:00+0000` (no colon in tz offset)
- Priority values: 0 (none), 1 (low), 3 (medium), 5 (high) — note the gap at 2 and 4
- Task status: 0 (active), 2 (completed) — note the gap at 1
