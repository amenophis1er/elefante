import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { userInfo } from "node:os";
import { createMemory, readMemory, updateMemory, deleteMemory, touchMemory } from "./memory.js";
import { search, listMemories, invalidateCache } from "./indexer.js";
import * as vault from "./vault.js";
import { createMemorySchema, updateMemorySchema } from "./types.js";
import type { MemoryType } from "./types.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DASHBOARD_DIR = join(__dirname, "dashboard");

const DASHBOARD_AUTHOR = `${safeUsername()}@dashboard`;

function safeUsername(): string {
  try {
    return userInfo().username || "unknown";
  } catch {
    return "unknown";
  }
}

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function json(res: ServerResponse, data: unknown, status = 200): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function error(res: ServerResponse, message: string, status = 400): void {
  json(res, { error: message }, status);
}

const MAX_BODY_BYTES = 1024 * 1024; // 1 MB

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buf = chunk as Buffer;
    size += buf.length;
    if (size > MAX_BODY_BYTES) {
      throw new Error("Request body too large");
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

function parseJsonBody(raw: string): Record<string, unknown> | Error {
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return new Error("Body must be a JSON object");
    }
    return parsed as Record<string, unknown>;
  } catch {
    return new Error("Invalid JSON body");
  }
}

function parseQuery(url: URL): Record<string, string> {
  const params: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    params[k] = v;
  });
  return params;
}

type RouteHandler = (req: IncomingMessage, res: ServerResponse, params: { path: string; query: Record<string, string>; id?: string }) => Promise<void>;

const apiRoutes: Record<string, RouteHandler> = {
  "GET /api/memories": async (_req, res, { query }) => {
    const filters: { type?: MemoryType; profile?: string; sort?: "updated" | "importance" | "created" } = {};
    if (query.type) filters.type = query.type as MemoryType;
    if (query.profile) filters.profile = query.profile;
    if (query.sort) filters.sort = query.sort as "updated" | "importance" | "created";
    const limit = parseInt(query.limit ?? "50", 10);
    const offset = parseInt(query.offset ?? "0", 10);
    const results = listMemories(filters, limit, offset);
    json(res, results);
  },

  "GET /api/memories/:id": async (_req, res, { id }) => {
    const memory = readMemory(id!);
    if (!memory) return error(res, "Memory not found", 404);
    touchMemory(id!).catch(() => {});
    json(res, memory);
  },

  "POST /api/memories": async (req, res) => {
    const body = parseJsonBody(await readBody(req));
    if (body instanceof Error) return error(res, body.message);
    const parsed = createMemorySchema.safeParse(body);
    if (!parsed.success) return error(res, parsed.error.message);
    const memory = await createMemory({
      ...parsed.data,
      author: DASHBOARD_AUTHOR,
    });
    json(res, memory, 201);
  },

  "PUT /api/memories/:id": async (req, res, { id }) => {
    const body = parseJsonBody(await readBody(req));
    if (body instanceof Error) return error(res, body.message);
    const parsed = updateMemorySchema.safeParse({ ...body, id });
    if (!parsed.success) return error(res, parsed.error.message);
    const memory = await updateMemory(parsed.data);
    if (!memory) return error(res, "Memory not found", 404);
    json(res, memory);
  },

  "DELETE /api/memories/:id": async (_req, res, { id }) => {
    const deleted = await deleteMemory(id!);
    if (!deleted) return error(res, "Memory not found", 404);
    json(res, { deleted: true });
  },

  "GET /api/search": async (_req, res, { query }) => {
    if (!query.q) return error(res, "Missing query parameter: q");
    const filters: { type?: MemoryType; profile?: string } = {};
    if (query.type) filters.type = query.type as MemoryType;
    if (query.profile) filters.profile = query.profile;
    const limit = parseInt(query.limit ?? "10", 10);
    const results = await search(query.q, filters, limit);
    json(res, results);
  },

  "GET /api/status": async (_req, res) => {
    const status = await vault.getStatus();
    json(res, status);
  },

  "POST /api/sync": async (_req, res) => {
    const result = await vault.pull();
    if (result.status !== "ok") return error(res, result.message, 500);
    invalidateCache();
    try {
      await vault.push();
    } catch {
      // Nothing to push
    }
    json(res, { synced: true });
  },
};

function matchRoute(method: string, pathname: string): { handler: RouteHandler; id?: string } | null {
  // Try exact match first
  const exact = `${method} ${pathname}`;
  if (apiRoutes[exact]) return { handler: apiRoutes[exact] };

  // Try parameterized routes
  const segments = pathname.split("/");
  if (segments.length >= 4 && segments[1] === "api" && segments[2] === "memories" && segments[3]) {
    const paramRoute = `${method} /api/memories/:id`;
    if (apiRoutes[paramRoute]) return { handler: apiRoutes[paramRoute], id: segments[3] };
  }

  return null;
}

function serveStatic(res: ServerResponse, pathname: string): void {
  // SPA fallback: serve index.html for non-file paths
  let filePath = join(DASHBOARD_DIR, pathname === "/" ? "index.html" : pathname);

  if (!existsSync(filePath)) {
    filePath = join(DASHBOARD_DIR, "index.html");
  }

  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("Dashboard not built. Run: npm run build:dashboard");
    return;
  }

  const ext = extname(filePath);
  const mime = MIME_TYPES[ext] ?? "application/octet-stream";

  try {
    const content = readFileSync(filePath);
    res.writeHead(200, { "Content-Type": mime });
    res.end(content);
  } catch {
    res.writeHead(500);
    res.end("Internal server error");
  }
}

export interface ServeOptions {
  port?: number;
  open?: boolean;
  dev?: boolean;
}

export async function startServer(options: ServeOptions = {}): Promise<{ url: string; close: () => void }> {
  const token = randomUUID();
  const port = options.port ?? 0; // 0 = random free port

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
    const pathname = url.pathname;
    const query = parseQuery(url);

    // CORS for local dev (Vite proxy)
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    // Token auth for API routes (skipped in dev mode)
    if (pathname.startsWith("/api/")) {
      if (!options.dev) {
        const authHeader = req.headers.authorization;
        const queryToken = url.searchParams.get("token");
        const providedToken = authHeader?.replace("Bearer ", "") ?? queryToken;

        if (providedToken !== token) {
          error(res, "Unauthorized", 401);
          return;
        }
      }

      const route = matchRoute(req.method ?? "GET", pathname);
      if (!route) {
        error(res, "Not found", 404);
        return;
      }

      try {
        await route.handler(req, res, { path: pathname, query, id: route.id });
      } catch (err) {
        const message = err instanceof Error ? err.message : "Internal server error";
        error(res, message, 500);
      }
      return;
    }

    // Static files — token checked via query param on initial page load
    if (pathname === "/" || pathname === "/index.html") {
      const queryToken = url.searchParams.get("token");
      if (queryToken !== token) {
        res.writeHead(401, { "Content-Type": "text/plain" });
        res.end("Unauthorized — open the dashboard using the URL printed at startup.");
        return;
      }
    }

    serveStatic(res, pathname);
  });

  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      const addr = server.address();
      const actualPort = typeof addr === "object" && addr ? addr.port : port;
      const url = `http://127.0.0.1:${actualPort}?token=${token}`;

      if (options.open !== false) {
        import("node:child_process").then(({ exec }) => {
          exec(`open "${url}"`);
        });
      }

      resolve({
        url,
        close: () => {
          vault.flushBatch().catch(() => {}).finally(() => server.close());
        },
      });
    });
  });
}
