/**
 * TickTick uses a non-standard date format: "2024-01-15T09:00:00+0000"
 * (no colon in the timezone offset). Standard ISO 8601 uses "+00:00".
 */

/**
 * Convert a Date object or ISO string into TickTick's date format.
 */
export function toTickTickDate(input: Date | string): string {
  const date = typeof input === "string" ? new Date(input) : input;
  // Get ISO string like "2024-01-15T09:00:00.000Z"
  const iso = date.toISOString();
  // Replace trailing Z with +0000 (TickTick format, no colon in offset)
  return iso.replace(/\.\d{3}Z$/, "+0000");
}

/**
 * Parse a TickTick date string into a standard Date object.
 * Handles both "+0000" (TickTick) and "+00:00" (standard) formats.
 */
export function fromTickTickDate(str: string): Date {
  // If the offset has no colon (e.g. +0000, +0800), insert one
  const normalized = str.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  return new Date(normalized);
}

/**
 * Check if a TickTick date string represents today in the given timezone.
 */
export function isToday(dateStr: string, timeZone = "UTC"): boolean {
  const date = fromTickTickDate(dateStr);
  const now = new Date();

  const dateDay = formatLocalDate(date, timeZone);
  const todayDay = formatLocalDate(now, timeZone);

  return dateDay === todayDay;
}

/**
 * Check if a TickTick date is overdue (before now, comparing in the given timezone).
 */
export function isOverdue(dateStr: string, timeZone = "UTC"): boolean {
  const date = fromTickTickDate(dateStr);
  const now = new Date();

  // For all-day tasks, compare dates only
  const dateDay = formatLocalDate(date, timeZone);
  const todayDay = formatLocalDate(now, timeZone);

  if (dateDay < todayDay) return true;
  if (dateDay > todayDay) return false;

  // Same day — compare actual times
  return date.getTime() < now.getTime();
}

/**
 * Check if a TickTick date falls within the next 7 days from today.
 */
export function isThisWeek(dateStr: string, timeZone = "UTC"): boolean {
  const date = fromTickTickDate(dateStr);
  const now = new Date();

  const dateDay = formatLocalDate(date, timeZone);
  const todayDay = formatLocalDate(now, timeZone);

  // Must be today or in the future
  if (dateDay < todayDay) return false;

  // Check if within 7 days
  const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const weekEndDay = formatLocalDate(sevenDaysLater, timeZone);

  return dateDay <= weekEndDay;
}

/**
 * Format a Date to a YYYY-MM-DD string in a specific timezone.
 * Uses Intl.DateTimeFormat for correct timezone handling.
 */
function formatLocalDate(date: Date, timeZone: string): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date); // returns "YYYY-MM-DD"
}
