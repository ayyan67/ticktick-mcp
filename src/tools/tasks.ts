import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TickTickClient } from "../client.js";
import type { Task, ProjectData } from "../types.js";
import { handleToolError } from "../errors.js";
import { formatTask, formatTaskList } from "../format.js";

const SubtaskInput = z.object({
  title: z.string().describe("Subtask title"),
  status: z
    .number()
    .optional()
    .describe("0 = incomplete, 1 = complete"),
});

export function registerTaskTools(
  server: McpServer,
  client: TickTickClient
): void {
  // --- get_task ---
  server.tool(
    "get_task",
    "Get a specific task by ID",
    {
      projectId: z.string().describe("The project ID containing the task"),
      taskId: z.string().describe("The task ID"),
    },
    async ({ projectId, taskId }) => {
      try {
        const task = await client.get<Task>(
          `/project/${projectId}/task/${taskId}`
        );
        return { content: [{ type: "text", text: formatTask(task) }] };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  // --- get_project_tasks ---
  server.tool(
    "get_project_tasks",
    "Get all tasks in a project",
    {
      projectId: z.string().describe("The project ID"),
    },
    async ({ projectId }) => {
      try {
        const data = await client.get<ProjectData>(
          `/project/${projectId}/data`
        );
        return {
          content: [
            {
              type: "text",
              text: formatTaskList(data.tasks ?? [], `Tasks in project ${projectId}`),
            },
          ],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  // --- create_task ---
  server.tool(
    "create_task",
    "Create a new task",
    {
      title: z.string().describe("Task title"),
      projectId: z.string().describe("Project ID to create the task in"),
      content: z.string().optional().describe("Task notes/content"),
      desc: z.string().optional().describe("Task description"),
      priority: z
        .number()
        .optional()
        .describe("Priority: 0=none, 1=low, 3=medium, 5=high"),
      startDate: z
        .string()
        .optional()
        .describe("Start date (ISO 8601 format)"),
      dueDate: z.string().optional().describe("Due date (ISO 8601 format)"),
      isAllDay: z.boolean().optional().describe("Whether this is an all-day task"),
      timeZone: z
        .string()
        .optional()
        .describe("Timezone (e.g. 'America/New_York')"),
      reminders: z
        .array(z.string())
        .optional()
        .describe("Reminder triggers (e.g. ['TRIGGER:P0DT9H0M0S'])"),
      repeatFlag: z
        .string()
        .optional()
        .describe("RRULE recurrence string (e.g. 'RRULE:FREQ=DAILY;INTERVAL=1')"),
      items: z
        .array(SubtaskInput)
        .optional()
        .describe("Checklist items / subtasks"),
    },
    async (params) => {
      try {
        const body: Record<string, unknown> = {
          title: params.title,
          projectId: params.projectId,
        };
        if (params.content !== undefined) body.content = params.content;
        if (params.desc !== undefined) body.desc = params.desc;
        if (params.priority !== undefined) body.priority = params.priority;
        if (params.startDate !== undefined) body.startDate = params.startDate;
        if (params.dueDate !== undefined) body.dueDate = params.dueDate;
        if (params.isAllDay !== undefined) body.isAllDay = params.isAllDay;
        if (params.timeZone !== undefined) body.timeZone = params.timeZone;
        if (params.reminders !== undefined) body.reminders = params.reminders;
        if (params.repeatFlag !== undefined) body.repeatFlag = params.repeatFlag;
        if (params.items !== undefined) body.items = params.items;

        const task = await client.post<Task>("/task", body);
        return {
          content: [
            {
              type: "text",
              text: `Task created successfully.\n\n${formatTask(task)}`,
            },
          ],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  // --- update_task ---
  server.tool(
    "update_task",
    "Update an existing task",
    {
      taskId: z.string().describe("The task ID to update"),
      projectId: z.string().describe("The project ID containing the task"),
      title: z.string().optional().describe("New task title"),
      content: z.string().optional().describe("New task notes/content"),
      desc: z.string().optional().describe("New task description"),
      priority: z
        .number()
        .optional()
        .describe("New priority: 0=none, 1=low, 3=medium, 5=high"),
      startDate: z.string().optional().describe("New start date (ISO 8601)"),
      dueDate: z.string().optional().describe("New due date (ISO 8601)"),
      isAllDay: z.boolean().optional().describe("Whether this is an all-day task"),
      timeZone: z.string().optional().describe("New timezone"),
      reminders: z.array(z.string()).optional().describe("New reminder triggers"),
      repeatFlag: z.string().optional().describe("New RRULE recurrence string"),
      items: z.array(SubtaskInput).optional().describe("New checklist items"),
    },
    async (params) => {
      try {
        const body: Record<string, unknown> = {
          id: params.taskId,
          projectId: params.projectId,
        };
        if (params.title !== undefined) body.title = params.title;
        if (params.content !== undefined) body.content = params.content;
        if (params.desc !== undefined) body.desc = params.desc;
        if (params.priority !== undefined) body.priority = params.priority;
        if (params.startDate !== undefined) body.startDate = params.startDate;
        if (params.dueDate !== undefined) body.dueDate = params.dueDate;
        if (params.isAllDay !== undefined) body.isAllDay = params.isAllDay;
        if (params.timeZone !== undefined) body.timeZone = params.timeZone;
        if (params.reminders !== undefined) body.reminders = params.reminders;
        if (params.repeatFlag !== undefined) body.repeatFlag = params.repeatFlag;
        if (params.items !== undefined) body.items = params.items;

        const task = await client.post<Task>(`/task/${params.taskId}`, body);
        return {
          content: [
            {
              type: "text",
              text: `Task updated successfully.\n\n${formatTask(task)}`,
            },
          ],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  // --- complete_task ---
  server.tool(
    "complete_task",
    "Mark a task as complete",
    {
      projectId: z.string().describe("The project ID containing the task"),
      taskId: z.string().describe("The task ID to complete"),
    },
    async ({ projectId, taskId }) => {
      try {
        await client.post(
          `/project/${projectId}/task/${taskId}/complete`
        );
        return {
          content: [
            { type: "text", text: `Task ${taskId} marked as complete.` },
          ],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  // --- delete_task ---
  server.tool(
    "delete_task",
    "Delete a task",
    {
      projectId: z.string().describe("The project ID containing the task"),
      taskId: z.string().describe("The task ID to delete"),
    },
    async ({ projectId, taskId }) => {
      try {
        await client.delete(`/project/${projectId}/task/${taskId}`);
        return {
          content: [
            { type: "text", text: `Task ${taskId} deleted successfully.` },
          ],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
}
