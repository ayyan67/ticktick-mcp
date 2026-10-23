#!/usr/bin/env node

/**
 * Standalone CLI for TickTick OAuth2 authentication.
 * Run: npm run auth
 *
 * 1. Opens browser to TickTick OAuth consent page
 * 2. Listens on 127.0.0.1:8000 for the callback
 * 3. Exchanges the auth code for tokens
 * 4. Prints tokens and Claude Desktop config snippet
 */

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import { URL } from "node:url";
import type { OAuthTokens } from "./types.js";

const PORT = 8000;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;
const AUTHORIZE_URL = "https://ticktick.com/oauth/authorize";
const TOKEN_URL = "https://ticktick.com/oauth/token";
const TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

async function main() {
  const clientId = process.env.TICKTICK_CLIENT_ID;
  const clientSecret = process.env.TICKTICK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error(
      "Error: TICKTICK_CLIENT_ID and TICKTICK_CLIENT_SECRET must be set.\n" +
        "Get these from https://developer.ticktick.com/manage"
    );
    process.exit(1);
  }

  const state = randomBytes(16).toString("hex");

  const authUrl = new URL(AUTHORIZE_URL);
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "tasks:read tasks:write");
  authUrl.searchParams.set("state", state);

  console.log("Opening browser for TickTick authorization...\n");
  console.log(`If the browser doesn't open, visit:\n${authUrl.toString()}\n`);

  // Dynamic import of `open` (ESM package)
  const open = (await import("open")).default;
  await open(authUrl.toString());

  // Wait for the OAuth callback
  const code = await waitForCallback(state);

  // Exchange code for tokens
  console.log("Exchanging authorization code for tokens...\n");

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`Token exchange failed: ${response.status} ${text}`);
    process.exit(1);
  }

  const tokens = (await response.json()) as OAuthTokens;

  console.log("=== Authentication Successful ===\n");
  console.log(`Access Token:  ${tokens.access_token}`);
  console.log(`Refresh Token: ${tokens.refresh_token}`);
  console.log(`Expires In:    ${tokens.expires_in}s`);
  console.log(`Scope:         ${tokens.scope}\n`);

  console.log("=== .env file ===\n");
  console.log(`TICKTICK_ACCESS_TOKEN=${tokens.access_token}`);
  console.log(`TICKTICK_REFRESH_TOKEN=${tokens.refresh_token}`);
  console.log(`TICKTICK_CLIENT_ID=${clientId}`);
  console.log(`TICKTICK_CLIENT_SECRET=${clientSecret}\n`);

  console.log("=== Claude Desktop MCP Config ===\n");
  console.log(
    JSON.stringify(
      {
        mcpServers: {
          ticktick: {
            command: "node",
            args: ["dist/index.js"],
            cwd: process.cwd(),
            env: {
              TICKTICK_ACCESS_TOKEN: tokens.access_token,
              TICKTICK_REFRESH_TOKEN: tokens.refresh_token,
              TICKTICK_CLIENT_ID: clientId,
              TICKTICK_CLIENT_SECRET: clientSecret,
            },
          },
        },
      },
      null,
      2
    )
  );

  process.exit(0);
}

function waitForCallback(expectedState: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("Timed out waiting for OAuth callback (5 minutes)."));
    }, TIMEOUT_MS);

    const server = createServer(
      (req: IncomingMessage, res: ServerResponse) => {
        const url = new URL(req.url ?? "/", `http://127.0.0.1:${PORT}`);

        if (url.pathname !== "/callback") {
          res.writeHead(404);
          res.end("Not found");
          return;
        }

        const code = url.searchParams.get("code");
        const returnedState = url.searchParams.get("state");

        // CSRF validation
        if (returnedState !== expectedState) {
          res.writeHead(400);
          res.end("State mismatch — possible CSRF attack. Please try again.");
          return;
        }

        if (!code) {
          const error = url.searchParams.get("error") ?? "unknown error";
          res.writeHead(400);
          res.end(`Authorization failed: ${error}`);
          reject(new Error(`Authorization failed: ${error}`));
          clearTimeout(timeout);
          server.close();
          return;
        }

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<html><body><h1>Authorization successful!</h1><p>You can close this tab and return to the terminal.</p></body></html>"
        );

        clearTimeout(timeout);
        server.close();
        resolve(code);
      }
    );

    // Bind to 127.0.0.1 only — NOT 0.0.0.0
    server.listen(PORT, "127.0.0.1", () => {
      console.log(`Listening for OAuth callback on http://127.0.0.1:${PORT}/callback\n`);
    });
  });
}

main().catch((error) => {
  console.error(`Fatal error: ${error}`);
  process.exit(1);
});
