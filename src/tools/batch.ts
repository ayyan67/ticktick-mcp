import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TickTickClient } from "../client.js";
import type { BatchTaskResponse } from "../types.js";
import { handleToolError } from "../errors.js";

const BatchAddTask = z.object({
  title: z.string().describe("Task title"),
  projectId: z.string().describe("Project ID"),
  content: z.string().optional().describe("Task notes"),
  priority: z.number().optional().describe("Priority: 0, 1, 3, or 5"),
  dueDate: z.string().optional().describe("Due date (ISO 8601)"),
  startDate: z.string().optional().describe("Start date (ISO 8601)"),
  isAllDay: z.boolean().optional().describe("All-day task"),
  timeZone: z.string().optional().describe("Timezone"),
});

const BatchUpdateTask = z.object({
  id: z.string().describe("Task ID"),
  projectId: z.string().describe("Project ID"),
  title: z.string().optional().describe("New title"),
  content: z.string().optional().describe("New notes"),
  priority: z.number().optional().describe("New priority"),
  dueDate: z.string().optional().describe("New due date"),
  startDate: z.string().optional().describe("New start date"),
});

const BatchDeleteTask = z.object({
  projectId: z.string().describe("Project ID"),
  taskId: z.string().describe("Task ID to delete"),
});

export function registerBatchTools(
  server: McpServer,
  client: TickTickClient
): void {
  server.tool(
    "batch_tasks",
    "Batch add, update, and/or delete multiple tasks in one request",
    {
      add: z.array(BatchAddTask).optional().describe("Tasks to create"),
      update: z.array(BatchUpdateTask).optional().describe("Tasks to update"),
      delete: z.array(BatchDeleteTask).optional().describe("Tasks to delete"),
    },
    async ({ add, update, delete: del }) => {
      try {
        const body: Record<string, unknown> = {};
        if (add && add.length > 0) body.add = add;
        if (update && update.length > 0) body.update = update;
        if (del && del.length > 0) {
          body.delete = del.map((d) => ({
            projectId: d.projectId,
            taskId: d.taskId,
          }));
        }

        const result = await client.post<BatchTaskResponse>(
          "/batch/task",
          body
        );

        const lines: string[] = ["Batch operation completed."];

        if (add?.length) lines.push(`  Added: ${add.length} task(s)`);
        if (update?.length) lines.push(`  Updated: ${update.length} task(s)`);
        if (del?.length) lines.push(`  Deleted: ${del.length} task(s)`);

        if (result?.id2error && Object.keys(result.id2error).length > 0) {
          lines.push("\nErrors:");
          for (const [id, err] of Object.entries(result.id2error)) {
            lines.push(`  ${id}: ${err.errorMessage} (${err.errorCode})`);
          }
        }

        return { content: [{ type: "text", text: lines.join("\n") }] };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
}
