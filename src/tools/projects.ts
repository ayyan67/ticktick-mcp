import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TickTickClient } from "../client.js";
import type { Project, ProjectData } from "../types.js";
import { handleToolError } from "../errors.js";
import { formatProject, formatTaskList } from "../format.js";

export function registerProjectTools(
  server: McpServer,
  client: TickTickClient
): void {
  // --- list_projects ---
  server.tool("list_projects", "List all projects in TickTick", {}, async () => {
    try {
      const projects = await client.get<Project[]>("/project");
      if (!projects || projects.length === 0) {
        return { content: [{ type: "text", text: "No projects found." }] };
      }
      const formatted = projects.map(formatProject).join("\n\n");
      return {
        content: [
          {
            type: "text",
            text: `${projects.length} project${projects.length === 1 ? "" : "s"}\n\n${formatted}`,
          },
        ],
      };
    } catch (error) {
      return handleToolError(error);
    }
  });

  // --- get_project ---
  server.tool(
    "get_project",
    "Get a project with its tasks",
    { projectId: z.string().describe("The project ID") },
    async ({ projectId }) => {
      try {
        const data = await client.get<ProjectData>(
          `/project/${projectId}/data`
        );
        const projectInfo = formatProject(data.project);
        const taskList = formatTaskList(
          data.tasks ?? [],
          "Tasks"
        );
        return {
          content: [{ type: "text", text: `${projectInfo}\n\n${taskList}` }],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  // --- create_project ---
  server.tool(
    "create_project",
    "Create a new project",
    {
      name: z.string().describe("Project name"),
      color: z.string().optional().describe("Project color (e.g. '#ff0000')"),
      viewMode: z
        .enum(["list", "kanban", "timeline"])
        .optional()
        .describe("Project view mode"),
    },
    async ({ name, color, viewMode }) => {
      try {
        const body: Record<string, unknown> = { name };
        if (color) body.color = color;
        if (viewMode) body.viewMode = viewMode;

        const project = await client.post<Project>("/project", body);
        return {
          content: [
            {
              type: "text",
              text: `Project created successfully.\n\n${formatProject(project)}`,
            },
          ],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  // --- update_project ---
  server.tool(
    "update_project",
    "Update an existing project",
    {
      projectId: z.string().describe("The project ID to update"),
      name: z.string().optional().describe("New project name"),
      color: z.string().optional().describe("New project color"),
      viewMode: z
        .enum(["list", "kanban", "timeline"])
        .optional()
        .describe("New view mode"),
    },
    async ({ projectId, name, color, viewMode }) => {
      try {
        const body: Record<string, unknown> = {};
        if (name !== undefined) body.name = name;
        if (color !== undefined) body.color = color;
        if (viewMode !== undefined) body.viewMode = viewMode;

        const project = await client.post<Project>(
          `/project/${projectId}`,
          body
        );
        return {
          content: [
            {
              type: "text",
              text: `Project updated successfully.\n\n${formatProject(project)}`,
            },
          ],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );

  // --- delete_project ---
  server.tool(
    "delete_project",
    "Delete a project",
    { projectId: z.string().describe("The project ID to delete") },
    async ({ projectId }) => {
      try {
        await client.delete(`/project/${projectId}`);
        return {
          content: [
            { type: "text", text: `Project ${projectId} deleted successfully.` },
          ],
        };
      } catch (error) {
        return handleToolError(error);
      }
    }
  );
}
