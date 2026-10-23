export class TickTickError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "TickTickError";
  }
}

export class TickTickAuthError extends TickTickError {
  constructor(message = "Authentication failed. Your access token may be expired. Try re-running the auth flow.") {
    super(message, 401);
    this.name = "TickTickAuthError";
  }
}

export class TickTickNotFoundError extends TickTickError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: "${id}". Double-check the ID and try again.`);
    this.name = "TickTickNotFoundError";
    this.statusCode = 404;
  }
}

export class TickTickRateLimitError extends TickTickError {
  constructor() {
    super("Rate limited by TickTick API. Wait a moment and try again.");
    this.name = "TickTickRateLimitError";
    this.statusCode = 429;
  }
}

/**
 * Convert any error into an MCP-compatible error response.
 * Messages are written for Claude to understand and act on.
 */
export function handleToolError(error: unknown): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  let message: string;

  if (error instanceof TickTickAuthError) {
    message = `Authentication Error: ${error.message}`;
  } else if (error instanceof TickTickNotFoundError) {
    message = `Not Found: ${error.message}`;
  } else if (error instanceof TickTickRateLimitError) {
    message = `Rate Limit: ${error.message}`;
  } else if (error instanceof TickTickError) {
    message = `TickTick API Error (${error.statusCode ?? "unknown"}): ${error.message}`;
  } else if (error instanceof Error) {
    message = `Error: ${error.message}`;
  } else {
    message = `Unknown error: ${String(error)}`;
  }

  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}
