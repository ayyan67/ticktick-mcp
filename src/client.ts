import {
  TickTickError,
  TickTickAuthError,
  TickTickNotFoundError,
  TickTickRateLimitError,
} from "./errors.js";
import type { OAuthTokens } from "./types.js";

const BASE_URL = "https://api.ticktick.com/open/v1";

export class TickTickClient {
  private accessToken: string;
  private refreshToken: string;
  private clientId: string;
  private clientSecret: string;

  constructor() {
    const accessToken = process.env.TICKTICK_ACCESS_TOKEN;
    const refreshToken = process.env.TICKTICK_REFRESH_TOKEN;
    const clientId = process.env.TICKTICK_CLIENT_ID;
    const clientSecret = process.env.TICKTICK_CLIENT_SECRET;

    if (!accessToken) {
      throw new Error(
        "TICKTICK_ACCESS_TOKEN is not set. Run `npm run auth` to get your tokens."
      );
    }

    this.accessToken = accessToken;
    this.refreshToken = refreshToken ?? "";
    this.clientId = clientId ?? "";
    this.clientSecret = clientSecret ?? "";
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    isRetry = false
  ): Promise<T> {
    const url = `${BASE_URL}${path}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
    };

    const response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    // Handle 401 — try token refresh once
    if (response.status === 401 && !isRetry) {
      const refreshed = await this.tryRefreshToken();
      if (refreshed) {
        return this.request<T>(method, path, body, true);
      }
      throw new TickTickAuthError();
    }

    if (response.status === 401) {
      throw new TickTickAuthError();
    }

    if (response.status === 404) {
      throw new TickTickNotFoundError("Resource", path);
    }

    if (response.status === 429) {
      throw new TickTickRateLimitError();
    }

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new TickTickError(
        `API request failed: ${response.status} ${response.statusText}${text ? ` - ${text}` : ""}`,
        response.status
      );
    }

    // Some endpoints return empty body (e.g. DELETE)
    const text = await response.text();
    if (!text) return undefined as T;

    return JSON.parse(text) as T;
  }

  private async tryRefreshToken(): Promise<boolean> {
    if (!this.refreshToken || !this.clientId || !this.clientSecret) {
      return false;
    }

    try {
      const response = await fetch("https://ticktick.com/oauth/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: this.refreshToken,
        }),
      });

      if (!response.ok) return false;

      const tokens = (await response.json()) as OAuthTokens;
      this.accessToken = tokens.access_token;
      if (tokens.refresh_token) {
        this.refreshToken = tokens.refresh_token;
      }

      process.stderr.write(
        "[ticktick-mcp] Access token refreshed successfully.\n"
      );
      return true;
    } catch {
      return false;
    }
  }

  async get<T>(path: string): Promise<T> {
    return this.request<T>("GET", path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async delete(path: string): Promise<void> {
    await this.request<void>("DELETE", path);
  }
}
