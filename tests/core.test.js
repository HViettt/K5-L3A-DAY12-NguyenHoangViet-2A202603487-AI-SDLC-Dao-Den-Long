// Test logic core phủ R2–R9 (docs/notes/phase-1.md mục 2). Mỗi test 1 scenario nhỏ trong tests/scenarios/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createWorld, step, snapshot } from "../src/core/world.js";
import { TUNING } from "../src/core/config.js";

const scenario = (name) =>
  JSON.parse(readFileSync(new URL(`./scenarios/${name}.json`, import.meta.url), "utf8"));

// Chạy n bước, ghi lại sự kiện kèm tick (tick = số bước đã chạy khi sự kiện xảy ra).
const run = (sc, inputs, ticks) => {
  const w = createWorld({ seed: 1, scenario: sc });
  const evs = [];
  for (let t = 1; t <= ticks; t++) {
    for (const e of step(w, inputs?.[t - 1] ?? {})) evs.push({ tick: t, ...e });
    if (w.state !== "playing") break;
  }
  return { w, evs };
};
const byName = (evs, name) => evs.filter((e) => e.name === name);

test("R2: 600 bước → time_left_s giảm đúng 10 s (không cộng dồn float)", () => {
  const { w } = run(scenario("r2-idle"), null, 600);
  assert.equal(snapshot(w).time_left_s, 290);
});

test("R2: 10 bước → time_left_s = 299.833 (làm tròn 3 số)", () => {
  const { w } = run(scenario("r2-idle"), null, 10);
  assert.equal(snapshot(w).time_left_s, 299.833);
});

test("R2: kết thúc vì hết giờ tại đúng bước thứ duration·60", () => {
  const { w, evs } = run(scenario("r2-idle"), null, 18000);
  assert.equal(w.tick, 18000);
  assert.equal(w.state, "lost");
  assert.deepEqual(byName(evs, "game_over").at(-1).data, { result: "lost", reason: "dawn" });
});

test("R3: move [0,1] yaw 0 → 60 tick đi +Z đúng 6 m", () => {
  const { w } = run(scenario("r3-move"), Array(60).fill({ move: [0, 1], cam_yaw_deg: 0 }), 60);
  const s = snapshot(w);
  assert.equal(s.player.pos[2], 6);
  assert.equal(s.player.pos[0], 0);
});

test("R3: yaw 90° → move [0,1] đi +X đúng 6 m", () => {
  const { w } = run(scenario("r3-move"), Array(60).fill({ move: [0, 1], cam_yaw_deg: 90 }), 60);
  const s = snapshot(w);
  assert.equal(s.player.pos[0], 6);
  assert.equal(s.player.pos[2], 0);
});

test("R3: move [1,1] dài hơn 1 được chuẩn hóa (x = z = 6/√2)", () => {
  const { w } = run(scenario("r3-move"), Array(60).fill({ move: [1, 1], cam_yaw_deg: 0 }), 60);
  const s = snapshot(w);
  assert.equal(s.player.pos[0], 4.243);
  assert.equal(s.player.pos[2], 4.243);
});

test("G1: đi ra ngoài đảo bị giữ lại ở mép (bán kính 40)", () => {
  const { w } = run(scenario("r3-move"), Array(600).fill({ move: [0, 1], cam_yaw_deg: 0 }), 600);
  const s = snapshot(w);
  assert.ok(Math.abs(s.player.pos[2]) <= 40.001, `z=${s.player.pos[2]}`);
  assert.ok(Math.hypot(s.player.pos[0], s.player.pos[2]) <= 40.001);
});

test("R4: nhặt mote (0,0,5) tại đúng tick đầu tiên dist ≤ pickup_radius", () => {
  const { w, evs } = run(scenario("r4-pickup"), Array(40).fill({ move: [0, 1], cam_yaw_deg: 0 }), 40);
  const picked = byName(evs, "mote_picked");
  assert.equal(picked.length, 1);
  // đi 0.1 m/tick: dist = |5 − 0.1·t| ≤ 1.5 lần đầu thỏa tại t = 35
  assert.equal(picked[0].tick, 35);
  assert.deepEqual(picked[0].data, { carried: 1 });
  assert.equal(w.score, TUNING.score.per_mote);
  assert.equal(w.motes.length, 0);
});

test("R4: đủ carry_capacity thì không nhặt", () => {
  const { w, evs } = run(scenario("r4-full"), [{}], 1);
  assert.equal(byName(evs, "mote_picked").length, 0);
  assert.equal(w.motes.length, 1);
  assert.equal(w.player.carried, TUNING.carry_capacity);
});

test("R5: interact cạnh L1 với carried 5 → deposit 5, lantern_lit, +100 điểm", () => {
  const { w, evs } = run(scenario("r5-deposit"), [{ interact: true }], 1);
  const dep = byName(evs, "deposit");
  assert.equal(dep.length, 1);
  assert.deepEqual(dep[0].data, { lantern_id: "L1", amount: 5, deposited: 5 });
  assert.deepEqual(byName(evs, "lantern_lit")[0].data, { lantern_id: "L1" });
  assert.equal(w.score, TUNING.score.per_lantern);
  assert.equal(w.lanterns[0].lit, true);
  assert.equal(w.player.carried, 0);
});

test("R6: pulse stun shade trong 6 m, đẩy 4 m, trừ 1 carried, +20 điểm", () => {
  const { w, evs } = run(scenario("r6-pulse"), [{ pulse: true }, { pulse: true }], 2);
  const pulses = byName(evs, "pulse");
  assert.equal(pulses.length, 1); // cooldown 1 s chặn pulse lần 2
  assert.deepEqual(pulses[0].data, { stunned_ids: ["S1"] });
  const s = w.shades[0];
  assert.equal(s.state, "stunned");
  assert.equal(snapshot(w).shades[0].pos[0], 9); // 5 + 4 đẩy ra xa player
  assert.equal(w.player.carried, 1);
  assert.equal(w.score, TUNING.score.per_stun);
});

test("R6: pulse hết cooldown thì dùng lại được, stun hết 3 s quay lại chase", () => {
  const w = createWorld({ seed: 1, scenario: scenario("r6-pulse") });
  step(w, { pulse: true }); // tick 1
  for (let i = 0; i < 59; i++) step(w, { pulse: false }); // ticks 2..60: nhả nút
  assert.equal(byName(step(w, { pulse: true }), "pulse").length, 1); // tick 61: cooldown 1 s hết
  assert.equal(w.player.carried, 0); // 2 − 1 − 1
  for (let i = 0; i < 179; i++) step(w, {}); // ticks 62..240
  assert.equal(w.shades[0].state, "chase"); // stun 3 s = 180 tick đã hết
});

test("R7: shade đuổi và chạm tại tick 155, dropped = floor(carried·0.5), invuln 2 s", () => {
  const { w, evs } = run(scenario("r7-chase"), null, 300);
  const hits = byName(evs, "player_hit");
  assert.equal(hits.length, 2); // 1 hit lúc 155, hit thứ 2 sau khi hết bất tử
  assert.equal(hits[0].tick, 155);
  assert.deepEqual(hits[0].data, { by: "shade", flames: 2, dropped: 2 });
  assert.equal(w.player.carried, 3 - 1); // 5 − 2 (rơi) − 1 (rơi lần 2: floor(3·0.5))
  assert.equal(hits[1].tick, 275); // invuln 2 s = 120 tick sau tick 155
  assert.deepEqual(hits[1].data, { by: "shade", flames: 1, dropped: 1 });
});

test("R8: shade không bao giờ vào trong 5 m quanh đèn đã thắp (trừ đúng mép)", () => {
  const w = createWorld({ seed: 1, scenario: scenario("r8-safe") });
  const l = w.lanterns[0];
  assert.equal(l.lit, true);
  let minD = Infinity;
  for (let t = 1; t <= 120; t++) {
    step(w, {});
    const s = w.shades[0];
    const d = Math.hypot(s.x - l.x, s.z - l.z);
    minD = Math.min(minD, d);
    if (t === 1) assert.ok(Math.abs(s.z - 20) < 1e-6, `tick 1 phải bị đẩy ra đúng mép (0,0,20), z=${s.z}`);
  }
  assert.ok(minD >= TUNING.safe_radius - 1e-9, `minDist=${minD}`);
});

test("R9: nạp đèn thứ 5 → won all_lit + thưởng thời gian + flame còn lại", () => {
  const { w, evs } = run(scenario("r9-win"), [{ interact: true }], 1);
  assert.equal(w.state, "won");
  const over = byName(evs, "game_over");
  assert.equal(over.length, 1);
  assert.deepEqual(over[0].data, { result: "won", reason: "all_lit" });
  // 100 (lantern) + floor((300·60−1)/60)·1 + 3·50 = 100 + 299 + 150
  assert.equal(w.score, 549);
});

test("R9: flames về 0 → lost no_flames", () => {
  const { w, evs } = run(scenario("r9-lose"), null, 1);
  assert.equal(w.state, "lost");
  assert.deepEqual(byName(evs, "player_hit")[0].data, { by: "shade", flames: 0, dropped: 2 });
  assert.deepEqual(byName(evs, "game_over")[0].data, { result: "lost", reason: "no_flames" });
});

test("R9: time_left 1 s → lost dawn đúng tick 60", () => {
  const { w, evs } = run(scenario("r9-dawn"), null, 60);
  assert.equal(w.tick, 60);
  assert.equal(w.state, "lost");
  assert.deepEqual(byName(evs, "game_over")[0].data, { result: "lost", reason: "dawn" });
  assert.equal(step(w, {}).length, 0); // hết game thì không còn bước nào
});
