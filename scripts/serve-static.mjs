/* global console */
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, URL } from "node:url";
const directory = path.dirname(fileURLToPath(import.meta.url));
export async function startStatic(root, port = 4173) {
  root = path.resolve(root);
  const settings = JSON.parse(
    fs.readFileSync(
      path.join(
        root,
        fs.existsSync(path.join(root, "vercel.json"))
          ? "vercel.json"
          : "../vercel.json",
      ),
      "utf8",
    ),
  );
  const headers = Object.fromEntries(
    settings.headers[0].headers.map((h) => [h.key, h.value]),
  );
  const mime = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".json": "application/json; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".csv": "text/csv; charset=utf-8",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".png": "image/png",
    ".ico": "image/x-icon",
  };
  const server = http.createServer((req, res) => {
    const fail = (status, text) => {
      res.writeHead(status, {
        ...headers,
        "Content-Type": "text/plain; charset=utf-8",
      });
      res.end(text);
    };
    if (req.method !== "GET" && req.method !== "HEAD")
      return fail(405, "Method not allowed");
    try {
      const pathname = decodeURIComponent(
        new URL(req.url ?? "/", "http://localhost").pathname,
      );
      let file = path.resolve(root, "." + pathname);
      if (file !== root && !file.startsWith(root + path.sep))
        return fail(403, "Forbidden");
      if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
        if (path.extname(pathname)) return fail(404, "Not found");
        file = path.join(root, "index.html");
      }
      const body = fs.readFileSync(file);
      res.writeHead(200, {
        ...headers,
        "Content-Type": mime[path.extname(file)] ?? "application/octet-stream",
        "Content-Length": body.byteLength,
        "Cache-Control": file.startsWith(path.join(root, "assets") + path.sep)
          ? "public, max-age=31536000, immutable"
          : "no-cache",
      });
      res.end(req.method === "HEAD" ? undefined : body);
    } catch {
      return fail(400, "Invalid request");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolve);
  });
  return server;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = fs.existsSync(path.join(directory, "index.html"))
    ? directory
    : path.resolve(directory, "../dist");
  const port = Number(process.env.PORT ?? 5173);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT must be an integer from 1 to 65535");
  const server = await startStatic(root, port);
  console.log(`GRE Pilot: http://127.0.0.1:${port} (Ctrl+C to stop)`);
  const stop = () => {
    server.closeAllConnections();
    server.close();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
