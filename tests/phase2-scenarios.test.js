// Scenario headless cho từng tính năng mới của Test Contract v1.1 (AC-02..AC-10).
// Mỗi tính năng chạy qua CLI đúng contract: snapshot + event JSONL, mã thoát 0.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const tmp = mkdtempSync(path.join(tmpdir(), "ddl-p2-"));
const scPath = (name) => path.join(root, "tests", "scenarios", `${name}.json`);

const runCli = (args) =>
  spawnSync(process.execPath, ["src/headless/cli.js", ...args], { cwd: root, encoding: "utf8" });

const readLines = (file) =>
  readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));

const events = (lines, name) => lines.filter((l) => l.type === "event" && l.name === name);
const snapAt = (lines, tick) => lines.find((l) => l.type === "snapshot" && l.tick === tick);

const writeInputs = (frames) => {
  const f = path.join(tmp, `in-${frames[0]?.tick ?? 0}-${frames.length}.json`);
  writeFileSync(f, JSON.stringify({ frames }));
  return f;
};

const base = (night, extra = []) => ["--seed", "1", "--night", String(night)];

test("AC-02 [dash.json]: dash 14 m/s × 12 tick, nhấn trong cooldown bị bỏ qua", () => {
  const out = path.join(tmp, "dash.jsonl");
  const inputs = writeInputs([
    { tick: 0, move: [1, 0] },
    { tick: 60, dash: true },
    { tick: 61, dash: false },
    { tick: 70, dash: true }, // đang lướt → bỏ qua
    { tick: 71, dash: false },
    { tick: 100, dash: true }, // còn cd → bỏ qua
    { tick: 101, dash: false },
  ]);
  const r = runCli([...base(1), "--ticks", "120", "--out", out, "--scenario", scPath("p2-dash"), "--inputs", inputs, "--snapshot-every", "1"]);
  assert.equal(r.status, 0, r.stderr);
  const lines = readLines(out);
  assert.equal(lines[0].type, "snapshot");
  assert.equal(lines[0].tick, 0);
  const dashes = events(lines, "dash");
  assert.equal(dashes.length, 1);
  assert.equal(dashes[0].tick, 61);
  // 60 tick thường (6 m) + 12 tick lướt (2.8 m) + 8 tick thường (0.8 m) = 9.6 m
  const s80 = snapAt(lines, 80);
  assert.ok(Math.abs(s80.player.pos[0] - (6 + 2.8 + 8 * 0.1)) < 1e-3, `x=${s80.player.pos[0]}`);
  const s61 = snapAt(lines, 61);
  assert.equal(s61.player.dash_cd_s, 1.5); // 1.5 s tính từ lúc bắt đầu lướt
});

test("AC-03 [fall.json]: rơi khỏi đảo → player_hit by=fall lost=n, hồi sinh sau 60 tick", () => {
  const out = path.join(tmp, "fall.jsonl");
  const inputs = writeInputs([{ tick: 0, move: [0, 1] }]);
  const r = runCli([...base(1), "--ticks", "200", "--out", out, "--scenario", scPath("p2-fall"), "--inputs", inputs, "--snapshot-every", "1"]);
  assert.equal(r.status, 0, r.stderr);
  const lines = readLines(out);
  const falls = events(lines, "player_hit");
  assert.equal(falls.length, 1);
  assert.deepEqual(falls[0].data, { by: "fall", flames: 2, lost: 4 });
  const hitTick = falls[0].tick;
  const sWait = snapAt(lines, hitTick + 10); // đang chờ hồi sinh
  assert.ok(sWait.player.pos[1] < 0);
  const sRespawn = snapAt(lines, hitTick + 65); // đã hồi sinh tại (0,0,0) sau 60 tick
  assert.equal(sRespawn.player.invuln, true);
  assert.equal(sRespawn.player.carried, 0);
  assert.equal(sRespawn.player.pos[1], 0);
});

test("AC-03 [fall-lose.json]: rơi khi còn 1 lửa → thua no_flames ngay", () => {
  const out = path.join(tmp, "fall-lose.jsonl");
  const inputs = writeInputs([{ tick: 0, move: [0, 1] }]);
  const r = runCli([...base(1), "--ticks", "100", "--out", out, "--scenario", scPath("p2-fall-lose"), "--inputs", inputs]);
  assert.equal(r.status, 0, r.stderr);
  const lines = readLines(out);
  assert.deepEqual(events(lines, "game_over")[0].data, { result: "lost", reason: "no_flames" });
  const end = lines.at(-1);
  assert.equal(end.type, "end");
  assert.equal(end.state, "lost");
});

test("AC-04 [pause.json]: paused/resumed, tick tăng nhưng sim_tick + thời gian đứng yên", () => {
  const out = path.join(tmp, "pause.jsonl");
  const inputs = writeInputs([
    { tick: 10, pause: true },
    { tick: 11, pause: false },
    { tick: 30, pause: true },
    { tick: 31, pause: false },
  ]);
  const r = runCli([...base(1), "--ticks", "50", "--out", out, "--scenario", scPath("p2-pause"), "--inputs", inputs, "--snapshot-every", "1"]);
  assert.equal(r.status, 0, r.stderr);
  const lines = readLines(out);
  assert.deepEqual(events(lines, "paused")[0], { type: "event", tick: 11, name: "paused", data: {} });
  assert.deepEqual(events(lines, "resumed")[0], { type: "event", tick: 31, name: "resumed", data: {} });
  const s20 = snapAt(lines, 20);
  assert.equal(s20.state, "paused");
  assert.equal(s20.tick, 20);
  assert.equal(s20.sim_tick, 10);
  assert.equal(s20.time_left_s, 299.833); // thời gian không trôi khi paused
  const s40 = snapAt(lines, 40);
  assert.equal(s40.state, "playing");
  assert.equal(s40.sim_tick, 20); // ticks 1..10 + ticks 31..40
  assert.equal(s40.time_left_s, 299.667);
});

test("AC-05 [shade-states.json]: đủ 5 trạng thái spawning/wander/chase/recoil/stunned", () => {
  const out = path.join(tmp, "shade-states.jsonl");
  const r = runCli([...base(1), "--ticks", "130", "--out", out, "--scenario", scPath("p2-shade-states"), "--snapshot-every", "1"]);
  assert.equal(r.status, 0, r.stderr);
  const lines = readLines(out);
  const s10 = snapAt(lines, 10);
  assert.equal(s10.shades.find((s) => s.id === "S1").state, "wander");
  assert.equal(s10.shades.find((s) => s.id === "S2").state, "stunned");
  assert.equal(s10.shades.find((s) => s.id === "S3").state, "wander"); // spawning 5 tick hết, dist 20 > 12 → wander
  const s0 = snapAt(lines, 0);
  assert.equal(s0.shades.find((s) => s.id === "S3").state, "spawning");
  const s70 = snapAt(lines, 70);
  assert.equal(s70.shades.find((s) => s.id === "S2").state, "chase"); // hết stun 60 tick (scenario cho sẵn)
  const hits = events(lines, "player_hit");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].tick, 118); // S2 hết stun ở Bước 2 tick 60 và bắt đầu đuổi ngay từ tick 60
  assert.deepEqual(hits[0].data, { by: "shade", flames: 2, dropped: 0 });
  const s120 = snapAt(lines, 120);
  assert.equal(s120.shades.find((s) => s.id === "S2").state, "recoil"); // bóng lùi 2 m trong 60 tick
});

test("AC-06 [pulse_v11.json]: cost 3, stun 120t, đẩy 4 m/15t, +5 điểm/con, cd 180t", () => {
  const out = path.join(tmp, "pulse.jsonl");
  const inputs = writeInputs([
    { tick: 0, pulse: true },
    { tick: 1, pulse: false },
    { tick: 180, pulse: true },
    { tick: 181, pulse: false },
  ]);
  const r = runCli([...base(1), "--ticks", "320", "--out", out, "--scenario", scPath("p2-pulse-v11"), "--inputs", inputs, "--snapshot-every", "1"]);
  assert.equal(r.status, 0, r.stderr);
  const lines = readLines(out);
  const pulses = events(lines, "pulse");
  assert.deepEqual(pulses.map((p) => [p.tick, p.data.stunned_ids]), [[1, ["S1"]], [181, ["S1"]]]); // pulse lại làm mới choáng
  const s16 = snapAt(lines, 16);
  assert.ok(Math.abs(s16.shades[0].pos[0] - 8) < 1e-6, `x=${s16.shades[0].pos[0]}`); // đẩy đủ 4 m sau 15 tick
  assert.equal(s16.shades[0].state, "stunned");
  const s190 = snapAt(lines, 190);
  assert.equal(s190.shades[0].state, "stunned"); // re-pulse refresh
  const s315 = snapAt(lines, 315); // stun lần 2 (181+120=301) đã hết → chase lại
  assert.equal(s315.shades[0].state, "chase");
  const end = lines.at(-1);
  assert.equal(end.score, 10); // +5 × 2
  assert.equal(end.state, "playing"); // chưa thắng (đèn chưa sáng)
});

test("AC-06 [pulse_v11-low.json]: < 3 đom đóm → không kích hoạt", () => {
  const out = path.join(tmp, "pulse-low.jsonl");
  const inputs = writeInputs([
    { tick: 0, pulse: true },
    { tick: 1, pulse: false },
  ]);
  const r = runCli([...base(1), "--ticks", "5", "--out", out, "--scenario", scPath("p2-pulse-v11-low"), "--inputs", inputs]);
  assert.equal(r.status, 0, r.stderr);
  const lines = readLines(out);
  assert.equal(events(lines, "pulse").length, 0);
  assert.equal(snapAt(lines, 5).player.carried, 2);
  assert.equal(snapAt(lines, 5).player.pulse_cd_s, 0);
});

test("AC-07 [night2_jump_pad.json]: bục (20,0,18) phóng vy=14/ngang 24 về đảo B", () => {
  const out = path.join(tmp, "pad.jsonl");
  const inputs = writeInputs([{ tick: 0, move: [0, -1] }]); // bơm input — không được ghi đè vận tốc phóng
  const r = runCli([...base(2), "--ticks", "100", "--out", out, "--scenario", scPath("p2-night2-jump-pad"), "--inputs", inputs, "--snapshot-every", "1"]);
  assert.equal(r.status, 0, r.stderr);
  const lines = readLines(out);
  const s5 = snapAt(lines, 5);
  assert.equal(s5.player.grounded, false);
  assert.ok(s5.player.vel[1] > 10, `vy=${s5.player.vel[1]}`); // đang bay lên
  const s90 = snapAt(lines, 90); // đã đáp (bay ~1.4 s = 84 tick)
  assert.equal(s90.player.grounded, true);
  assert.equal(s90.player.pos[1], 0);
  const [x, z] = [s90.player.pos[0], s90.player.pos[2]];
  assert.ok(Math.hypot(x - 70, z) <= 28, `phải đáp trong đảo B (${x},${z})`);
  assert.ok(Math.abs(x - 51.2) < 1.0, `(${x},${z})`);
  assert.equal(s90.charms[0].available, true); // C1 (35,0,0) không bị nhặt nhầm khi bay qua
});

test("AC-08 [night3_terrain_wind.json]: dốc 30° lên Y=3, bục lên Y=6, gió mạnh theo chu kỳ", () => {
  const out = path.join(tmp, "n3wind.jsonl");
  const inputs = writeInputs([
    { tick: 0, move: [-0.8660254, -0.5] },
    { tick: 60, move: [-0.9986, 0.0507] },
    { tick: 330, move: [0, 0] },
  ]);
  const r = runCli([...base(3), "--ticks", "2300", "--out", out, "--scenario", scPath("p2-night3-terrain-wind"), "--inputs", inputs, "--snapshot-every", "10"]);
  assert.equal(r.status, 0, r.stderr);
  const lines = readLines(out);
  const s60 = snapAt(lines, 60);
  assert.equal(s60.player.pos[1], 3); // đã lên tầng 1 qua dốc
  const s330 = snapAt(lines, 330);
  assert.equal(s330.player.pos[1], 6); // đã đáp tầng 2 qua bục
  assert.equal(s330.player.grounded, true);
  const s1700 = snapAt(lines, 1700);
  assert.equal(s1700.wind.active, false); // đang giai đoạn báo trước 2 s
  const s1900 = snapAt(lines, 1900);
  assert.equal(s1900.wind.active, true); // gió hoạt động 1800..2099
  const s2300 = snapAt(lines, 2300);
  assert.equal(s2300.wind.active, false); // hết cơn gió
  const p1700 = s1700.player.pos;
  const p2090 = snapAt(lines, 2090).player.pos;
  const moved = Math.hypot(p2090[0] - p1700[0], p2090[2] - p1700[2]);
  assert.ok(moved > 0.1, `bị gió đẩy (d=${moved})`);
});

test("AC-09 [drifter.json]: cướp min(3, carried), pulse lúc flee → drifter_drop", () => {
  const out = path.join(tmp, "drifter.jsonl");
  const inputs = writeInputs([
    { tick: 79, pulse: true },
    { tick: 80, pulse: false },
  ]);
  const r = runCli([...base(2), "--ticks", "250", "--out", out, "--scenario", scPath("p2-drifter"), "--inputs", inputs, "--snapshot-every", "10"]);
  assert.equal(r.status, 0, r.stderr);
  const lines = readLines(out);
  const steal = events(lines, "drifter_steal");
  assert.deepEqual(steal[0], { type: "event", tick: 76, name: "drifter_steal", data: { drifter_id: "D1", amount: 3, carried: 3 } });
  const drop = events(lines, "drifter_drop");
  assert.deepEqual(drop[0], { type: "event", tick: 80, name: "drifter_drop", data: { drifter_id: "D1", amount: 3 } });
  const s100 = snapAt(lines, 100);
  assert.equal(s100.drifters[0].state, "removed");
  assert.equal(s100.motes.filter((m) => m.kind === "dropped").length, 3);
  assert.ok(s100.motes.every((m) => m.ttl_s === null || m.ttl_s <= 8.0));
  const s210 = snapAt(lines, 210);
  assert.equal(s210.drifters.length, 0); // biến mất sau 120 tick
  const s80 = snapAt(lines, 80);
  assert.equal(s80.player.carried, 0); // 6 − 3 (bị cướp) − 3 (pulse)
});

test("AC-10 [charm.json]: charm_picked 600t, dash không hồi chiêu, bùa hồi 2700t", () => {
  const out = path.join(tmp, "charm.jsonl");
  const inputs = writeInputs([
    { tick: 0, move: [1, 0] },
    { tick: 30, dash: true },
    { tick: 31, dash: false },
    { tick: 45, dash: true },
    { tick: 46, dash: false },
  ]);
  const r = runCli([...base(2), "--ticks", "2760", "--out", out, "--scenario", scPath("p2-charm"), "--inputs", inputs, "--snapshot-every", "10"]);
  assert.equal(r.status, 0, r.stderr);
  const lines = readLines(out);
  const picked = events(lines, "charm_picked");
  assert.equal(picked.length, 1);
  assert.ok(picked[0].tick === 25 || picked[0].tick === 26); // dist ≤ 1 m (biên float)
  assert.deepEqual(picked[0].data, { charm_id: "C1", charm_ticks: 600 });
  const dashes = events(lines, "dash");
  assert.deepEqual(dashes.map((d) => d.tick), [31, 46]); // 2 lần dash liên tiếp, không cd
  const s30 = snapAt(lines, 30);
  assert.equal(s30.charms[0].available, false);
  assert.equal(s30.player.charm_s > 0, true);
  const s2740 = snapAt(lines, 2740);
  assert.equal(s2740.charms[0].available, true); // bùa hồi lại sau 2700 tick
  assert.equal(s2740.charms[0].respawn_s, 0);
});

test("v1.1: snapshot gốc đủ trường bắt buộc mới (night, wind, vel, motes/drifters/charms)", () => {
  const out = path.join(tmp, "fields.jsonl");
  const r = runCli([...base(2), "--ticks", "5", "--out", out, "--scenario", scPath("p2-charm")]);
  assert.equal(r.status, 0, r.stderr);
  const s0 = readLines(out)[0];
  for (const key of ["night", "wind", "sim_tick"]) assert.ok(key in s0, `thiếu ${key}`);
  assert.ok("vel" in s0.player && "grounded" in s0.player && "invuln" in s0.player);
  assert.ok("dash_cd_s" in s0.player && "pulse_cd_s" in s0.player && "charm_s" in s0.player);
  for (const m of s0.motes) assert.ok("kind" in m && "ttl_s" in m);
  assert.ok(Array.isArray(s0.drifters) && Array.isArray(s0.charms));
  for (const c of s0.charms) assert.ok("available" in c && "respawn_s" in c);
});
