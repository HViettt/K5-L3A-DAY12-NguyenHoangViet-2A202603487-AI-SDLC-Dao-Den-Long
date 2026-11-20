#!/usr/bin/env node
// Static server + API Bảng xếp hạng cục bộ + --export-leaderboard (Ticket-04 mục 3).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { loadLeaderboard, addLeaderboardEntry, exportLeaderboard } from "../src/headless/leaderboard.js";

// Hỗ trợ lệnh bắt buộc: <run_cmd> --export-leaderboard out.json
const expIdx = process.argv.indexOf("--export-leaderboard");
if (expIdx !== -1) {
  const outPath = process.argv[expIdx + 1];
  if (!outPath) {
    process.stderr.write("Thiếu đường dẫn file sau --export-leaderboard\n");
    process.exit(1);
  }
  exportLeaderboard(outPath);
  process.exit(0);
}

const root = normalize(fileURLToPath(new URL("..", import.meta.url)));
const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
};
const port = Number(process.env.PORT ?? 8080);

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (c) => { body += c; if (body.length > 65536) reject(new Error("payload too large")); });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const p = decodeURIComponent(url.pathname);

  if (p === "/api/leaderboard" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify(loadLeaderboard()));
  }
  if (p === "/api/leaderboard" && req.method === "POST") {
    try {
      const payload = JSON.parse(await readBody(req));
      const data = addLeaderboardEntry(payload);
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ error: e.message }));
    }
  }

  if (p === "/") {
    res.writeHead(302, { Location: "/src/web/index.html" });
    return res.end();
  }
  const file = normalize(join(root, p));
  if (!file.startsWith(root)) {
    res.writeHead(403);
    return res.end();
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
}).listen(port, () => console.log(`Đảo Đèn Lồng: http://localhost:${port}`));
