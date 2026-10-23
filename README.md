# ticktick-mcp

A [Model Context Protocol](https://modelcontextprotocol.io) server for
[TickTick](https://ticktick.com). It exposes 20 tools over stdio so an MCP client such
as Claude Code or Claude Desktop can read, create, update, and complete your tasks and
projects through the TickTick Open API.

Written in TypeScript with `@modelcontextprotocol/sdk` and `zod`. It has no other
runtime dependencies besides `open`, which the auth script uses to launch the browser.

## Tools

**Projects**

| Tool | What it does |
|---|---|
| `list_projects` | List all projects |
| `get_project` | Get one project and its tasks |
| `create_project` | Create a project (name, optional color) |
| `update_project` | Rename or recolor a project |
| `delete_project` | Delete a project |

**Tasks**

| Tool | What it does |
|---|---|
| `get_task` | Get one task by project ID and task ID |
| `get_project_tasks` | List the tasks in a project |
| `create_task` | Create a task with optional content, priority, start/due dates, all-day flag, time zone, reminders, recurrence rule, and subtasks |
| `update_task` | Update any of those fields; only the fields you pass are sent |
| `complete_task` | Mark a task complete |
| `delete_task` | Delete a task |
| `batch_tasks` | Add, update, and delete multiple tasks in one request |

**Queries** (each accepts an optional `projectId`; without it they search every
project, including the Inbox)

| Tool | What it does |
|---|---|
| `get_all_tasks` | All tasks, optionally including completed ones |
| `get_tasks_due_today` | Tasks due today in your local time zone |
| `get_tasks_due_this_week` | Tasks due in the next 7 days |
| `get_overdue_tasks` | Incomplete tasks past their due date |
| `get_tasks_by_priority` | Tasks at a given priority (0 none, 1 low, 3 medium, 5 high) |
| `search_tasks` | Text search over title, content, and description |
| `get_tasks_with_reminders` | Tasks that have reminders |
| `get_recurring_tasks` | Tasks with a recurrence rule |

The Open API has no server-side filtering, so the query tools fetch every project's
tasks (plus the Inbox, which `GET /project` does not return) and filter in memory. A
failure fetching one project does not fail the whole query.

## Setup

Requires Node 18 or newer (20.6+ for the `--env-file` flag used below).

```bash
npm install
npm run build
```

### 1. Register a TickTick app

1. Go to the [TickTick developer portal](https://developer.ticktick.com/manage) and
   create an app.
2. Set its redirect URI to `http://127.0.0.1:8000/callback`.
3. Copy the client ID and client secret.

### 2. Get tokens

`npm run auth` runs an OAuth 2.0 authorization-code flow: it opens the TickTick
consent page in your browser, listens on `127.0.0.1:8000` (loopback only) for the
callback, checks the `state` parameter, and exchanges the code for tokens. It reads the
client credentials from the environment:

```bash
cp .env.example .env
# fill in TICKTICK_CLIENT_ID and TICKTICK_CLIENT_SECRET, then:
node --env-file=.env dist/auth.js
```

(or `export` the two variables and run `npm run auth`).

The script prints the access token, refresh token, a `.env` block, and a Claude Desktop
config snippet. `.env` is gitignored.

### 3. Add it to an MCP client

The server reads its configuration only from environment variables; it does not load
`.env` itself. Pass them through the client config. Use the absolute path to
`dist/index.js`.

**Claude Code**

```bash
claude mcp add ticktick \
  -e TICKTICK_ACCESS_TOKEN=... \
  -e TICKTICK_REFRESH_TOKEN=... \
  -e TICKTICK_CLIENT_ID=... \
  -e TICKTICK_CLIENT_SECRET=... \
  -- node /absolute/path/to/ticktick-mcp/dist/index.js
```

**Claude Desktop**

Add this to `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows), then restart the
app:

```json
{
  "mcpServers": {
    "ticktick": {
      "command": "node",
      "args": ["/absolute/path/to/ticktick-mcp/dist/index.js"],
      "env": {
        "TICKTICK_ACCESS_TOKEN": "...",
        "TICKTICK_REFRESH_TOKEN": "...",
        "TICKTICK_CLIENT_ID": "...",
        "TICKTICK_CLIENT_SECRET": "..."
      }
    }
  }
}
```

Only `TICKTICK_ACCESS_TOKEN` is required. The other three enable token refresh.

To poke at the tools without a client:
`npx @modelcontextprotocol/inspector node dist/index.js`.

## Token refresh

`src/client.ts` wraps `fetch`. On a 401 it calls TickTick's token endpoint with the
refresh token and client credentials (HTTP Basic auth), swaps in the new access token,
and retries the request once. A second 401 is returned to the client as an
authentication error that tells you to re-run the auth flow.

The refreshed token is kept in memory only. It is not written back to `.env` or the
client config, so after a restart the server starts from the original token and
refreshes again when needed.

## Layout

```
src/
  index.ts        server setup, registers tool groups, stdio transport
  client.ts       HTTP client with 401 -> refresh -> retry
  auth.ts         standalone OAuth CLI (not imported by the server)
  tools/          projects, tasks, batch, filters
  types.ts        zod schemas and types for TickTick objects
  dates.ts        TickTick's "+0000" offset format, time-zone-aware day/week checks
  format.ts       plain-text formatting of tasks and projects for tool output
  errors.ts       error classes and conversion to MCP error results
```

TickTick API details worth knowing: updates use `POST` rather than `PUT`/`PATCH`;
priorities are 0, 1, 3, 5; task status is 0 (open) or 2 (completed); dates use a
`+0000` offset with no colon.

All logging goes to stderr, since stdout carries the MCP protocol.
