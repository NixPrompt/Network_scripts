import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(join(dirname(fileURLToPath(import.meta.url)), ".."));
const port = Number(process.env.PORT || 8000);
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function resolveRequestPath(urlPath) {
  const decoded = decodeURIComponent(urlPath);
  const normalized = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const requested = resolve(join(root, normalized));
  if (!requested.startsWith(root)) {
    return null;
  }
  return decoded.endsWith("/") ? join(requested, "index.html") : requested;
}

createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  const filePath = resolveRequestPath(url.pathname);

  if (!filePath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}).listen(port, () => {
  console.log(`FoxOps dashboard: http://localhost:${port}/dashboard/`);
});
