// Kiểm thử Phase 4 — TICKET-04 (Contract v1.3, Soak test, Leaderboard, Map 3 spawn).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { CONTRACT } from "../src/core/config.js";
import { MAPS } from "../src/core/maps.js";
import { addLeaderboardEntry, exportLeaderboard, loadLeaderboard } from "../src/headless/leaderboard.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const tmp = mkdtempSync(path.join(tmpdir(), "ddl-p4-"));

test("P4-01: game.contract.json v1.3 có đủ bench_cmd và soak_cmd", () => {
  assert.equal(CONTRACT.contract_version, "1.3");
  assert.ok(typeof CONTRACT.bench_cmd === "string" && CONTRACT.bench_cmd.length > 0);
  assert.ok(typeof CONTRACT.soak_cmd === "string" && CONTRACT.soak_cmd.length > 0);
});

test("P4-02: Map 3 (Đảo Chuông) xuất phát trên tầng 0 thoáng (không chìm dưới trụ tầng 2)", () => {
  const [x, y, z] = MAPS[3].spawn;
  assert.equal(y, 0);
  assert.ok(Math.hypot(x, z) > 8, "spawn Đêm 3 phải ngoài đĩa tầng 2 (r>8)");
});

test("P4-03: Soak test 3 Đêm chạy không crash và RSS ổn định ≤ 1.2×", () => {
  const out = path.join(tmp, "soak.json");
  const r = spawnSync(process.execPath, ["src/headless/soak.js", "--seed", "7", "--nights", "3", "--out", out], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  const data = JSON.parse(readFileSync(out, "utf8"));
  assert.equal(data.nights, 3);
  assert.equal(data.crashes, 0);
  assert.equal(data.results.length, 3);
  assert.ok(data.mem_end_mb <= data.mem_start_mb * 1.2, `RSS tăng quá 20%: ${data.mem_start_mb} -> ${data.mem_end_mb}`);
});

test("P4-04: Bảng xếp hạng lưu đĩa, kiểm tra tên 3–12 ký tự, top 10, sắp xếp đúng + --export-leaderboard", () => {
  const lbFile = path.join(tmp, "lb.json");
  assert.throws(() => addLeaderboardEntry({ name: "ab", score: 100, nights_won: 1, seed: 1 }, lbFile)); // < 3 ký tự
  assert.throws(() => addLeaderboardEntry({ name: "ten qua dai 1234", score: 100, nights_won: 1, seed: 1 }, lbFile));
  addLeaderboardEntry({ name: "May_01", score: 500, nights_won: 2, seed: 1, achieved_at: "2026-11-20T16:00:00+07:00" }, lbFile);
  addLeaderboardEntry({ name: "Viet_VN", score: 500, nights_won: 3, seed: 2, achieved_at: "2026-11-20T15:00:00+07:00" }, lbFile);
  addLeaderboardEntry({ name: "Huyền", score: 900, nights_won: 3, seed: 3, achieved_at: "2026-11-20T16:10:00+07:00" }, lbFile);
  const lb = loadLeaderboard(lbFile);
  assert.deepEqual(lb.entries.map((e) => e.name), ["Huyền", "Viet_VN", "May_01"]); // score giảm, bằng điểm ai sớm hơn đứng trên
  const expFile = path.join(tmp, "export.json");
  exportLeaderboard(expFile, lbFile);
  const exported = JSON.parse(readFileSync(expFile, "utf8"));
  assert.equal(exported.entries.length, 3);

  // Kiểm tra CLI <run_cmd> --export-leaderboard
  const cliExp = path.join(tmp, "cli-export.json");
  const r = spawnSync(process.execPath, ["scripts/serve.js", "--export-leaderboard", cliExp], {
    cwd: root,
    encoding: "utf8",
  });
  assert.equal(r.status, 0, r.stderr);
  const cliData = JSON.parse(readFileSync(cliExp, "utf8"));
  assert.ok(Array.isArray(cliData.entries));
});
