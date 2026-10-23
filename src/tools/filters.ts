import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TickTickClient } from "../client.js";
import type { Project, ProjectData, Task } from "../types.js";
import { handleToolError } from "../errors.js";
import { formatTaskList } from "../format.js";
import { isToday, isOverdue, isThisWeek } from "../dates.js";

/**
 * Fetch all tasks, optionally scoped to a single project.
 * If no projectId is given, fetches tasks from all projects including the Inbox.
 * The Inbox is a special project not returned by GET /project, but accessible
 * via GET /project/inbox/data.
 */
async function fetchAllTasks(
  client: TickTickClient,
  projectId?: string
): Promise<Task[]> {
  if (projectId) {
    const data = await client.get<ProjectData>(
      `/project/${projectId}/data`
    );
    return data.tasks ?? [];
  }

  // Fetch all projects + the Inbox (which isn't listed in GET /project)
  const projects = await client.get<Project[]>("/project");
  const allTasks: Task[] = [];

  // Fetch Inbox tasks first
  try {
    const inbox = await client.get<ProjectData>("/project/inbox/data");
    if (inbox.tasks) {
      allTasks.push(...inbox.tasks);
    }
  } catch {
    // Inbox fetch may fail — continue with other projects
  }

  for (const project of projects) {
    if (!project.id) continue;
    try {
      const data = await client.get<ProjectData>(
        `/project/${project.id}/data`
      );
      if (data.tasks) {
        allTasks.push(...data.tasks);
      }
    } catch {
      // Skip projects that fail (e.g. permission issues)
    }
  }

  return allTasks;
}

export function registerFilterTools(
  server: McpServer,
  client: TickTickClient
): void {
  // --- get_all_tasks ---
  server.tool(
    "get_all_tasks",
    "Get all tasks, optionally filtered by project or completion status",
    {
      projectId: z.string().optional().describe("Filter by project ID"),
      includeCompleted: z
        .boolean()
        .optional()
        .describe("Include completed tasks (default: false)"),
    },
    async ({ projectId, includeCompleted }) => {
      try {
        let tasks = await fetchAllTasks(client, projectId);
        if (!includeCompleted) {
          tasks = tasks.filter((t) => t.status !== 2);
        }
        return {
          content: [{ type: "text", text: formatTaskList(tasks, "All tasks") }],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  // --- get_tasks_due_today ---
  server.tool(
    "get_tasks_due_today",
    "Get tasks due today",
    {
      projectId: z.string().optional().describe("Filter by project ID"),
      timeZone: z
        .string()
        .optional()
        .describe("Timezone for date comparison (default: UTC)"),
    },
    async ({ projectId, timeZone }) => {
      try {
        const tasks = await fetchAllTasks(client, projectId);
        const tz = timeZone ?? "UTC";
        const filtered = tasks.filter(
          (t) => t.status !== 2 && t.dueDate && isToday(t.dueDate, tz)
        );
        return {
          content: [
            { type: "text", text: formatTaskList(filtered, "Tasks due today") },
          ],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  // --- get_tasks_due_this_week ---
  server.tool(
    "get_tasks_due_this_week",
    "Get tasks due within the next 7 days",
    {
      projectId: z.string().optional().describe("Filter by project ID"),
      timeZone: z
        .string()
        .optional()
        .describe("Timezone for date comparison (default: UTC)"),
    },
    async ({ projectId, timeZone }) => {
      try {
        const tasks = await fetchAllTasks(client, projectId);
        const tz = timeZone ?? "UTC";
        const filtered = tasks.filter(
          (t) => t.status !== 2 && t.dueDate && isThisWeek(t.dueDate, tz)
        );
        return {
          content: [
            {
              type: "text",
              text: formatTaskList(filtered, "Tasks due this week"),
            },
          ],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  // --- get_overdue_tasks ---
  server.tool(
    "get_overdue_tasks",
    "Get overdue tasks (past due date, not completed)",
    {
      projectId: z.string().optional().describe("Filter by project ID"),
      timeZone: z
        .string()
        .optional()
        .describe("Timezone for date comparison (default: UTC)"),
    },
    async ({ projectId, timeZone }) => {
      try {
        const tasks = await fetchAllTasks(client, projectId);
        const tz = timeZone ?? "UTC";
        const filtered = tasks.filter(
          (t) => t.status !== 2 && t.dueDate && isOverdue(t.dueDate, tz)
        );
        return {
          content: [
            { type: "text", text: formatTaskList(filtered, "Overdue tasks") },
          ],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  // --- get_tasks_by_priority ---
  server.tool(
    "get_tasks_by_priority",
    "Get tasks filtered by priority level",
    {
      priority: z
        .number()
        .describe("Priority level: 0=none, 1=low, 3=medium, 5=high"),
      projectId: z.string().optional().describe("Filter by project ID"),
    },
    async ({ priority, projectId }) => {
      try {
        const tasks = await fetchAllTasks(client, projectId);
        const filtered = tasks.filter(
          (t) => t.status !== 2 && t.priority === priority
        );
        const labels: Record<number, string> = {
          0: "no",
          1: "low",
          3: "medium",
          5: "high",
        };
        const label = labels[priority] ?? String(priority);
        return {
          content: [
            {
              type: "text",
              text: formatTaskList(filtered, `Tasks with ${label} priority`),
            },
          ],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  // --- search_tasks ---
  server.tool(
    "search_tasks",
    "Search tasks by title, content, or description",
    {
      query: z.string().describe("Search query (case-insensitive)"),
      projectId: z.string().optional().describe("Filter by project ID"),
    },
    async ({ query, projectId }) => {
      try {
        const tasks = await fetchAllTasks(client, projectId);
        const q = query.toLowerCase();
        const filtered = tasks.filter((t) => {
          const title = (t.title ?? "").toLowerCase();
          const content = (t.content ?? "").toLowerCase();
          const desc = (t.desc ?? "").toLowerCase();
          return title.includes(q) || content.includes(q) || desc.includes(q);
        });
        return {
          content: [
            {
              type: "text",
              text: formatTaskList(filtered, `Search results for "${query}"`),
            },
          ],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  // --- get_tasks_with_reminders ---
  server.tool(
    "get_tasks_with_reminders",
    "Get tasks that have reminders set",
    {
      projectId: z.string().optional().describe("Filter by project ID"),
    },
    async ({ projectId }) => {
      try {
        const tasks = await fetchAllTasks(client, projectId);
        const filtered = tasks.filter(
          (t) =>
            t.status !== 2 && t.reminders && t.reminders.length > 0
        );
        return {
          content: [
            {
              type: "text",
              text: formatTaskList(filtered, "Tasks with reminders"),
            },
          ],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  // --- get_recurring_tasks ---
  server.tool(
    "get_recurring_tasks",
    "Get tasks that have a recurrence rule",
    {
      projectId: z.string().optional().describe("Filter by project ID"),
    },
    async ({ projectId }) => {
      try {
        const tasks = await fetchAllTasks(client, projectId);
        const filtered = tasks.filter(
          (t) => t.status !== 2 && t.repeatFlag
        );
        return {
          content: [
            {
              type: "text",
              text: formatTaskList(filtered, "Recurring tasks"),
            },
          ],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
}
