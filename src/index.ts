#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { TickTickClient } from "./client.js";
import { registerProjectTools } from "./tools/projects.js";
import { registerTaskTools } from "./tools/tasks.js";
import { registerBatchTools } from "./tools/batch.js";
import { registerFilterTools } from "./tools/filters.js";

async function main() {
  const server = new McpServer({
    name: "ticktick",
    version: "1.0.0",
  });

  const client = new TickTickClient();

  registerProjectTools(server, client);
  registerTaskTools(server, client);
  registerBatchTools(server, client);
  registerFilterTools(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write("[ticktick-mcp] Server started on stdio.\n");
}

main().catch((error) => {
  process.stderr.write(`[ticktick-mcp] Fatal error: ${error}\n`);
  process.exit(1);
});
