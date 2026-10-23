import type { Task, Project, Subtask } from "./types.js";
import { fromTickTickDate } from "./dates.js";

const PRIORITY_LABELS: Record<number, string> = {
  0: "",
  1: "[LOW] ",
  3: "[MED] ",
  5: "[HIGH] ",
};

/**
 * Format a date string into a human-readable form.
 */
function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return "";
  try {
    const date = fromTickTickDate(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

/**
 * Format a subtask/checklist item.
 */
function formatSubtask(item: Subtask): string {
  const check = item.status === 1 ? "[x]" : "[ ]";
  return `  ${check} ${item.title}`;
}

/**
 * Format a single task for LLM-readable output.
 */
export function formatTask(task: Task): string {
  const lines: string[] = [];
  const priority = PRIORITY_LABELS[task.priority] ?? "";
  const status = task.status === 2 ? " (completed)" : "";

  lines.push(`${priority}${task.title}${status}`);
  lines.push(`  ID: ${task.id ?? "unknown"} | Project: ${task.projectId}`);

  if (task.dueDate) {
    lines.push(`  Due: ${formatDate(task.dueDate)}`);
  }
  if (task.startDate) {
    lines.push(`  Start: ${formatDate(task.startDate)}`);
  }
  if (task.content) {
    lines.push(`  Notes: ${task.content}`);
  }
  if (task.desc) {
    lines.push(`  Description: ${task.desc}`);
  }
  if (task.tags && task.tags.length > 0) {
    lines.push(`  Tags: ${task.tags.join(", ")}`);
  }
  if (task.repeatFlag) {
    lines.push(`  Repeat: ${task.repeatFlag}`);
  }
  if (task.reminders && task.reminders.length > 0) {
    lines.push(`  Reminders: ${task.reminders.join(", ")}`);
  }
  if (task.timeZone) {
    lines.push(`  Timezone: ${task.timeZone}`);
  }
  if (task.items && task.items.length > 0) {
    lines.push("  Checklist:");
    for (const item of task.items) {
      lines.push(formatSubtask(item));
    }
  }

  return lines.join("\n");
}

/**
 * Format a project for LLM-readable output.
 */
export function formatProject(project: Project): string {
  const lines: string[] = [];
  const closed = project.closed ? " (closed)" : "";

  lines.push(`${project.name}${closed}`);
  lines.push(`  ID: ${project.id ?? "unknown"}`);

  if (project.color) {
    lines.push(`  Color: ${project.color}`);
  }
  if (project.viewMode) {
    lines.push(`  View: ${project.viewMode}`);
  }

  return lines.join("\n");
}

/**
 * Format a list of tasks with a header.
 */
export function formatTaskList(tasks: Task[], header?: string): string {
  if (tasks.length === 0) {
    return header ? `${header}\n\nNo tasks found.` : "No tasks found.";
  }

  const formatted = tasks.map(formatTask).join("\n\n");
  const count = `${tasks.length} task${tasks.length === 1 ? "" : "s"}`;

  if (header) {
    return `${header} (${count})\n\n${formatted}`;
  }
  return `${count}\n\n${formatted}`;
}
