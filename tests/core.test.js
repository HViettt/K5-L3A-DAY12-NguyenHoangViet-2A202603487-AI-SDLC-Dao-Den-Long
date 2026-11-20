// Test logic core phủ R2–R9, cập nhật số chuẩn Test Contract v1.1 (Phase 2 — TICKET-02).
// Thay đổi so với Phase 1 xem docs/notes/phase-2.md mục 1 (Delta).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createWorld, step, snapshot } from "../src/core/world.js";
import { TUNING } from "../src/core/config.js";

const scenario = (name) =>
  JSON.parse(readFileSync(new URL(`./scenarios/${name}.json`, import.meta.url), "utf8"));

// Chạy n bước, ghi lại sự kiện kèm tick (tick = số bước đã chạy khi sự kiện xảy ra).
const run = (sc, inputs, ticks, night = 1) => {
  const w = createWorld({ seed: 1, night, scenario: sc });
  const evs = [];
  for (let t = 1; t <= ticks; t++) {
    for (const e of step(w, inputs?.[t - 1] ?? {})) evs.push({ tick: t, ...e });
    if (w.state !== "playing") break;
  }
  return { w, evs };
};
const byName = (evs, name) => evs.filter((e) => e.name === name);
const evSet = byName;

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

// fall_enabled = true từ v1.1: không còn kẹp mép đảo — đi quá bán kính 40 thì rơi thật.
test("G1 (v1.1): đi ra quá bán kính 40 → rơi, player_hit by=fall (bỏ clamp mép)", () => {
  const { w, evs } = run(scenario("r3-move"), Array(470).fill({ move: [0, 1], cam_yaw_deg: 0 }), 470);
  const falls = byName(evs, "player_hit").filter((e) => e.data.by === "fall");
  assert.equal(falls.length, 1);
  assert.equal(falls[0].tick, 461); // z=40.1 tại tick 401, rơi ~60 tick tới Y<−10
  assert.deepEqual(falls[0].data, { by: "fall", flames: 2, lost: 0 });
  const s = snapshot(w);
  assert.equal(s.player.carried, 0);
});

// R4 cập nhật: pickup_radius 1.0 (v1.1); điểm KHÔNG cộng khi nhặt (chỉ cộng khi nạp — A2-8).
test("R4: nhặt mote (0,0,5) khi dist XZ ≤ 1.0 và chênh cao ≤ 1.5, không cộng điểm", () => {
  const { w, evs } = run(scenario("r4-pickup"), Array(45).fill({ move: [0, 1], cam_yaw_deg: 0 }), 45);
  const picked = byName(evs, "mote_picked");
  assert.equal(picked.length, 1);
  // đi 0.1 m/tick: dist = |5 − 0.1·t| ≤ 1.0 — biên float nên nhận 40 hoặc 41
  assert.ok(picked[0].tick === 40 || picked[0].tick === 41, `tick=${picked[0].tick}`);
  assert.deepEqual(picked[0].data, { carried: 1 });
  assert.equal(w.score, 0); // v1.1: +10 chỉ khi NẠP
  assert.equal(w.motes.length, 0);
});

test("R4: đủ carry_capacity thì không nhặt", () => {
  const { w, evs } = run(scenario("r4-full"), [{}], 1);
  assert.equal(byName(evs, "mote_picked").length, 0);
  assert.equal(w.motes.length, 1);
  assert.equal(w.player.carried, TUNING.carry_capacity);
});

// R5 cập nhật: lantern_cost 10 (v1.1) — nạp 10, thắp, +10·10 (nạp) + 100 (đèn).
test("R5: interact cạnh L1 với carried 10 → deposit 10, lantern_lit, +200 điểm", () => {
  const { w, evs } = run(scenario("r5-deposit"), [{ interact: true }], 1);
  const dep = byName(evs, "deposit");
  assert.equal(dep.length, 1);
  assert.deepEqual(dep[0].data, { lantern_id: "L1", amount: 10, deposited: 10 });
  assert.deepEqual(byName(evs, "lantern_lit")[0].data, { lantern_id: "L1" });
  assert.equal(w.score, 2 * TUNING.score.per_lantern); // 10·per_mote + per_lantern
  assert.equal(w.lanterns[0].lit, true);
  assert.equal(w.player.carried, 0);
});

// R6 cập nhật: pulse cost 3, radius 5 (3D), stun 120 tick, đẩy 4 m trong 15 tick, cd 180, +5 điểm.
test("R6: pulse stun shade trong 5 m (3D), đẩy dần 4 m/15 tick, trừ 3 carried, +5 điểm", () => {
  const { w, evs } = run(scenario("r6-pulse"), [{ pulse: true }, { pulse: false }], 15);
  const pulses = byName(evs, "pulse");
  assert.equal(pulses.length, 1);
  assert.deepEqual(pulses[0].data, { stunned_ids: ["S1"] });
  const s = w.shades[0];
  assert.equal(s.state, "stunned");
  assert.equal(w.player.carried, 2); // 5 − 3
  assert.equal(w.score, TUNING.score.per_stun);
  // đẩy 15 lần (tick 1..15) × 4/15 m = đủ 4 m
  assert.ok(Math.abs(s.x - 8) < 1e-9, `x=${s.x}`);
  assert.equal(s.state, "stunned"); // stun 120 tick chưa hết (tick 15)
});

test("R6: pulse hết cooldown 180 tick thì dùng lại được (con choáng cũng bị trúng)", () => {
  const w = createWorld({
    seed: 1,
    scenario: {
      player: { carried: 6 },
      random_motes: false,
      random_shades: false,
      motes: [],
      shades: [{ pos: [4, 0, 0] }],
    },
  });
  step(w, { pulse: true }); // tick 1
  for (let i = 0; i < 179; i++) step(w, { pulse: false }); // ticks 2..180: nhả nút
  assert.equal(w.player.carried, 3); // 6 − 3
  const evs = step(w, { pulse: true }); // tick 181: hết cooldown; shade đã đuổi lại gần (dist 4 ≤ 5)
  assert.equal(evSet(evs, "pulse").length, 1);
  assert.equal(w.player.carried, 0);
  assert.equal(w.shades[0].state, "stunned"); // pulse lại làm mới choáng
  assert.equal(w.score, 2 * TUNING.score.per_stun); // +5 mỗi lần, kể cả khi re-pulse
});

// R7 cập nhật: shade 4.0 m/s, invuln 90 tick, bóng vào recoil 60 tick sau khi gây hit.
test("R7: shade đuổi, chạm tick 134 (dropped=floor(carried·0.5), invuln 1.5 s), hit sau recoil", () => {
  const { w, evs } = run(scenario("r7-chase"), null, 300);
  const hits = byName(evs, "player_hit").filter((e) => e.data.by === "shade");
  assert.equal(hits.length, 2);
  assert.equal(hits[0].tick, 134);
  assert.deepEqual(hits[0].data, { by: "shade", flames: 2, dropped: 2 });
  const droppedMotes = w.motes.filter((m) => m.kind === "dropped");
  assert.ok(droppedMotes.length >= 2); // đom đóm rơi tồn tại (TTL 480 tick)
  assert.equal(hits[1].tick, 224); // recoil 60t + đuổi lại, hết invuln 90 tick từ tick 134
  assert.deepEqual(hits[1].data, { by: "shade", flames: 1, dropped: 1 });
  assert.equal(w.player.carried, 2); // 5 − 2 − 1 (đom đóm rơi ra vành 1.5–2.5 m, TTL 480t)
});

// R8 cập nhật: safe_radius 6 (v1.1) — shade bị đẩy ra đúng mép 6 m và không bao giờ vào sâu hơn.
test("R8: shade không bao giờ vào trong 6 m quanh đèn đã thắp (trừ đúng mép)", () => {
  const w = createWorld({ seed: 1, scenario: scenario("r8-safe") });
  const l = w.lanterns[0];
  assert.equal(l.lit, true);
  let minD = Infinity;
  for (let t = 1; t <= 120; t++) {
    step(w, {});
    const s = w.shades[0];
    const d = Math.hypot(s.x - l.x, s.z - l.z);
    minD = Math.min(minD, d);
  }
  // tick 1 shade bị đẩy ra khỏi vùng an toàn ngay (đạt yêu cầu ≤ 30 tick)
  assert.ok(minD >= TUNING.safe_radius - 1e-9, `minDist=${minD}`);
  assert.ok(Math.abs(minD - TUNING.safe_radius) < 1e-6); // đứng sát mép 6 m
});

// R9 cập nhật: điểm thắng = 100 (nạp) + 100 (đèn) + floor(time_left)·2 + flames·50.
test("R9: nạp đèn thứ 5 → won all_lit + thưởng thời gian + flame còn lại", () => {
  const { w, evs } = run(scenario("r9-win"), [{ interact: true }], 1);
  assert.equal(w.state, "won");
  const over = byName(evs, "game_over");
  assert.equal(over.length, 1);
  assert.deepEqual(over[0].data, { result: "won", reason: "all_lit" });
  // 10·10 (nạp) + 100 (đèn) + floor((300·60−1)/60)·2 + 3·50 = 100 + 100 + 598 + 150
  assert.equal(w.score, 948);
});

test("R9: flames về 0 → lost no_flames (ưu tiên thua cao nhất)", () => {
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
