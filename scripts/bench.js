#!/usr/bin/env node
// Benchmark runner theo Test Contract v1.3 (Ticket-04 mục 1).
// Lệnh: node scripts/bench.js --seed 42 --duration 30 --out bench.json
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { spawn } from "node:child_process";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import os from "node:os";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    if (eq !== -1) args[a.slice(2, eq)] = a.slice(eq + 1);
    else {
      const k = a.slice(2);
      const v = argv[i + 1];
      if (v !== undefined && !v.startsWith("--")) { args[k] = v; i += 1; }
      else args[k] = "";
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const seed = Number.parseInt(args.seed ?? "42", 10);
const duration = Number.parseFloat(args.duration ?? "30");
const outPath = args.out;
if (!Number.isInteger(seed) || !Number.isFinite(duration) || duration <= 0 || !outPath) {
  process.stderr.write("Usage: node scripts/bench.js --seed <int> --duration <sec> --out <bench.json>\n");
  process.exit(1);
}

function findBrowser() {
  const envBin = process.env.BENCH_BROWSER;
  if (envBin && existsSync(envBin)) return envBin;
  const candidates =
    process.platform === "win32"
      ? [
          "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
          "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
          "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        ]
      : process.platform === "darwin"
      ? [
          "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
          "/Applications/Chromium.app/Contents/MacOS/Chromium",
          "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        ]
      : [
          "/usr/bin/google-chrome",
          "/usr/bin/google-chrome-stable",
          "/usr/bin/chromium",
          "/usr/bin/chromium-browser",
          "/snap/bin/chromium",
        ];
  return candidates.find((p) => existsSync(p)) || null;
}

const browser = findBrowser();
if (!browser) {
  process.stderr.write("bench: không tìm thấy Chrome/Chromium/Edge (đặt BENCH_BROWSER nếu ở đường dẫn khác)\n");
  process.exit(1);
}

const root = normalize(fileURLToPath(new URL("..", import.meta.url)));
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };
const tStart = Date.now();
const profileDir = mkdtempSync(join(os.tmpdir(), "ddl-bench-profile-"));
let child = null;
let finished = false;

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  const p = decodeURIComponent(url.pathname);
  if (p === "/__bench_done" && req.method === "POST") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try {
        const data = JSON.parse(body);
        const result = {
          contract_version: "1.3",
          avg_fps: data.avg_fps,
          p1_low_fps: data.p1_low_fps,
          frame_ms_p95: data.frame_ms_p95,
          frames: data.frames,
          load_ms: Math.round(data.load_ms ?? Date.now() - tStart),
          peak_mem_mb: data.peak_mem_mb ?? null,
          vsync_off: true,
          renderer: data.renderer || "Three.js 0.170.0 (WebGL2)",
          os: `${os.platform()} ${os.release()} (${os.arch()})`,
        };
        writeFileSync(outPath, JSON.stringify(result, null, 2) + "\n", "utf8");
        res.writeHead(200);
        res.end("ok");
        finished = true;
        cleanup(0);
      } catch (e) {
        res.writeHead(400);
        res.end(e.message);
        cleanup(1);
      }
    });
    return;
  }
  const file = normalize(join(root, p));
  if (!file.startsWith(root)) { res.writeHead(403); return res.end(); }
  try {
    const data = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});

function cleanup(code) {
  try { server.close(); } catch {}
  try { if (child && !child.killed) child.kill(); } catch {}
  setTimeout(() => {
    try { rmSync(profileDir, { recursive: true, force: true }); } catch {}
    process.exit(code);
  }, 250);
}

server.listen(0, "127.0.0.1", () => {
  const { port } = server.address();
  const benchUrl = `http://127.0.0.1:${port}/src/web/index.html?bench=1&seed=${seed}&duration=${duration}&t0=${tStart}`;
  child = spawn(
    browser,
    [
      `--user-data-dir=${profileDir}`,
      "--window-size=1280,720",
      "--disable-frame-rate-limit",
      "--disable-gpu-vsync",
      "--no-first-run",
      "--no-default-browser-check",
      `--app=${benchUrl}`,
    ],
    { stdio: "ignore" }
  );
  child.on("exit", () => {
    if (!finished) {
      process.stderr.write("bench: trình duyệt đóng trước khi gửi kết quả\n");
      cleanup(1);
    }
  });
  // Timeout an toàn: duration + 25s
  setTimeout(() => {
    if (!finished) {
      process.stderr.write("bench: hết thời gian chờ kết quả benchmark\n");
      cleanup(1);
    }
  }, (duration + 25) * 1000).unref();
});
