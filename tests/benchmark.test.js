// Benchmark Test Contract v1.1: chạy headless 1 Đêm đầy đủ (21.600 tick) trong ≤ 30 giây.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const tmp = mkdtempSync(path.join(tmpdir(), "ddl-bench-"));
const scPath = path.join(root, "tests", "scenarios", "p2-bench-night3.json");

// Cập nhật theo TICKET-03: thời lượng Đêm 3 đổi từ 360 s (21.600 tick) sang 300 s (18.000 tick).
test("AC-11: Đêm 3 đầy đủ 18.000 tick chạy xong trong ≤ 30 giây", () => {
  const out = path.join(tmp, "bench.jsonl");
  const t0 = Date.now();
  const r = spawnSync(
    process.execPath,
    ["src/headless/cli.js", "--seed", "7", "--night", "3", "--ticks", "21600", "--out", out, "--scenario", scPath],
    { cwd: root, encoding: "utf8" }
  );
  const elapsed = Date.now() - t0;
  assert.equal(r.status, 0, r.stderr);
  const lines = readFileSync(out, "utf8").trim().split("\n").map((l) => JSON.parse(l));
  const end = lines.at(-1);
  assert.equal(end.type, "end");
  assert.equal(end.ticks, 18000); // Đêm 3 = 300 s = 18.000 tick (Ticket-03)
  assert.equal(end.state, "lost");
  assert.equal(lines.at(-2).tick, 18000);
  assert.ok(elapsed <= 30000, `18.000 tick mất ${elapsed} ms (> 30 s)`);
});
