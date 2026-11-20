// Test CLI theo Test Contract mục B/E, phủ R1, R2, R10 (docs/notes/phase-1.md mục 2).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const tmp = mkdtempSync(path.join(tmpdir(), "ddl-cli-"));
const scPath = (name) => path.join(root, "tests", "scenarios", `${name}.json`);

const runCli = (args) =>
  spawnSync(process.execPath, ["src/headless/cli.js", ...args], { cwd: root, encoding: "utf8" });

const readLines = (file) =>
  readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));

test("R1: chạy đủ tham số → mã 0, JSONL hợp lệ, dòng cuối là end", () => {
  const out = path.join(tmp, "r1.jsonl");
  const r = runCli(["--seed", "1", "--night", "1", "--ticks", "10", "--out", out, "--scenario", scPath("r2-idle")]);
  assert.equal(r.status, 0, r.stderr);
  const lines = readLines(out);
  assert.equal(lines[0].type, "snapshot");
  assert.equal(lines[0].tick, 0);
  const last = lines.at(-1);
  assert.equal(last.type, "end");
  assert.equal(last.ticks, 10);
  assert.equal(last.state, "playing");
});

test("R2: --ticks 10 → snapshot tick 0 và 10, time_left = 300 − 10/60", () => {
  const out = path.join(tmp, "r2.jsonl");
  const r = runCli(["--seed", "1", "--night", "1", "--ticks", "10", "--out", out, "--scenario", scPath("r2-idle")]);
  assert.equal(r.status, 0, r.stderr);
  const lines = readLines(out);
  const snaps = lines.filter((l) => l.type === "snapshot");
  assert.deepEqual(snaps.map((s) => s.tick), [0, 10]);
  assert.equal(snaps.at(-1).time_left_s, 299.833);
  assert.equal(snaps.at(-1).sim_tick, 10);
});

test("R2: game kết thúc sớm → dừng đúng lúc, có snapshot cuối, end.state won", () => {
  const out = path.join(tmp, "r2win.jsonl");
  const r = runCli(["--seed", "1", "--night", "1", "--ticks", "100", "--out", out, "--scenario", scPath("r9-win"), "--inputs", inputsFile([{ tick: 0, interact: true }, { tick: 1, interact: false }])]);
  assert.equal(r.status, 0, r.stderr);
  const lines = readLines(out);
  const last = lines.at(-1);
  assert.equal(last.type, "end");
  assert.equal(last.ticks, 1);
  assert.equal(last.state, "won");
  assert.ok(lines.some((l) => l.type === "event" && l.name === "game_over" && l.tick === 1));
  assert.ok(lines.some((l) => l.type === "snapshot" && l.tick === 1)); // snapshot cuối dù 1 không chia hết 10
});

test("R1: file inputs JSON hỏng → mã 2 + stderr", () => {
  const bad = path.join(tmp, "bad.json");
  writeFileSync(bad, "{not json");
  const r = runCli(["--seed", "1", "--night", "1", "--ticks", "5", "--out", path.join(tmp, "x.jsonl"), "--inputs", bad]);
  assert.equal(r.status, 2);
  assert.ok(r.stderr.length > 0);
});

test("R1: file inputs sai định dạng (tick không tăng nghiêm ngặt) → mã 2", () => {
  const bad = path.join(tmp, "bad-inputs.json");
  writeFileSync(bad, JSON.stringify({ frames: [{ tick: 5 }, { tick: 5 }] }));
  const r = runCli(["--seed", "1", "--night", "1", "--ticks", "10", "--out", path.join(tmp, "x.jsonl"), "--inputs", bad]);
  assert.equal(r.status, 2);
});

test("R1: file scenario sai định dạng (motes sai shape) → mã 2", () => {
  const bad = path.join(tmp, "bad-scenario.json");
  writeFileSync(bad, JSON.stringify({ motes: [[0, 0]] }));
  const r = runCli(["--seed", "1", "--night", "1", "--ticks", "5", "--out", path.join(tmp, "x.jsonl"), "--scenario", bad]);
  assert.equal(r.status, 2);
});

test("R1: scenario có lantern id lạ → mã 2", () => {
  const bad = path.join(tmp, "bad-lantern.json");
  writeFileSync(bad, JSON.stringify({ lanterns: [{ id: "L9" }] }));
  const r = runCli(["--seed", "1", "--night", "1", "--ticks", "5", "--out", path.join(tmp, "x.jsonl"), "--scenario", bad]);
  assert.equal(r.status, 2);
});

test("R1: thiếu --out → mã ≠ 0", () => {
  const r = runCli(["--seed", "1", "--night", "1", "--ticks", "5"]);
  assert.notEqual(r.status, 0);
});

test("R1: thiếu --ticks và --seed → mã 1", () => {
  const r = runCli(["--night", "1", "--out", path.join(tmp, "x.jsonl")]);
  assert.equal(r.status, 1);
  assert.ok(r.stderr.includes("--seed"));
});

test("R1: --night 2 (chưa hỗ trợ) → mã 1", () => {
  const r = runCli(["--seed", "1", "--night", "2", "--ticks", "5", "--out", path.join(tmp, "x.jsonl")]);
  assert.equal(r.status, 1);
});

test("R10: cùng seed + mặc định random bật → 2 lần chạy giống hệt từng byte", () => {
  const a = path.join(tmp, "det-a.jsonl");
  const b = path.join(tmp, "det-b.jsonl");
  for (const f of [a, b]) {
    const r = runCli(["--seed", "42", "--night", "1", "--ticks", "300", "--out", f]);
    assert.equal(r.status, 0, r.stderr);
  }
  assert.equal(readFileSync(a, "utf8"), readFileSync(b, "utf8"));
  // random thật sự bật: có đom đóm và 2 Bóng Múc ban đầu
  const s0 = readLines(a)[0];
  assert.equal(s0.motes_active, 30);
  assert.deepEqual(s0.shades.map((s) => s.id), ["S1", "S2"]);
});

function inputsFile(frames) {
  const f = path.join(tmp, `in-${frames[0]?.tick ?? 0}.json`);
  writeFileSync(f, JSON.stringify({ frames }));
  return f;
}
