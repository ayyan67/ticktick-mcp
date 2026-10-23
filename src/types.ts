import { z } from "zod";

// --- Subtask / Checklist Item ---

export const SubtaskSchema = z.object({
  id: z.string().optional(),
  title: z.string(),
  status: z.number().default(0), // 0 = incomplete, 1 = complete (for checklist items: 0=normal, 1=completed)
  isAllDay: z.boolean().optional(),
  sortOrder: z.number().optional(),
  startDate: z.string().optional(),
  timeZone: z.string().optional(),
});

export type Subtask = z.infer<typeof SubtaskSchema>;

// --- Task ---

export const TaskSchema = z.object({
  id: z.string().optional(),
  projectId: z.string(),
  title: z.string(),
  content: z.string().optional(), // description/notes
  desc: z.string().optional(), // additional description
  priority: z.number().default(0), // 0=none, 1=low, 3=medium, 5=high
  status: z.number().default(0), // 0=active, 2=completed
  startDate: z.string().optional(), // TickTick date format
  dueDate: z.string().optional(),
  isAllDay: z.boolean().optional(),
  timeZone: z.string().optional(),
  reminders: z.array(z.string()).optional(), // e.g. ["TRIGGER:P0DT9H0M0S", "TRIGGER:PT0S"]
  repeatFlag: z.string().optional(), // RRULE string
  items: z.array(SubtaskSchema).optional(), // checklist items
  sortOrder: z.number().optional(),
  tags: z.array(z.string()).optional(),
  modifiedTime: z.string().optional(),
  createdTime: z.string().optional(),
  completedTime: z.string().optional(),
  kind: z.string().optional(),
});

export type Task = z.infer<typeof TaskSchema>;

// --- Project ---

export const ProjectSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  color: z.string().optional(),
  viewMode: z.string().optional(), // "list", "kanban", "timeline"
  sortOrder: z.number().optional(),
  closed: z.boolean().optional(),
  groupId: z.string().optional(),
  kind: z.string().optional(),
  modifiedTime: z.string().optional(),
});

export type Project = z.infer<typeof ProjectSchema>;

// --- ProjectData (returned by GET /project/{id}/data) ---

export const ProjectDataSchema = z.object({
  project: ProjectSchema,
  tasks: z.array(TaskSchema).optional(),
});

export type ProjectData = z.infer<typeof ProjectDataSchema>;

// --- Batch request/response ---

export const BatchTaskRequestSchema = z.object({
  add: z.array(TaskSchema).optional(),
  update: z.array(TaskSchema).optional(),
  delete: z
    .array(
      z.object({
        projectId: z.string(),
        taskId: z.string(),
      })
    )
    .optional(),
});

export type BatchTaskRequest = z.infer<typeof BatchTaskRequestSchema>;

export interface BatchTaskResponse {
  id2etag?: Record<string, string>;
  id2error?: Record<string, { errorCode: string; errorMessage: string }>;
}

// --- OAuth tokens ---

export interface OAuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}
