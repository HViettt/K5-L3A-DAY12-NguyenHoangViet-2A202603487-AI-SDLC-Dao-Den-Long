// Kiểm thử Phase 3 — TICKET-03 ("Đèn cạn dầu") + Test Contract v1.2 (P3-01..P3-06).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createWorld, step, snapshot } from "../src/core/world.js";

const idle = { random_motes: false, random_shades: false, motes: [], shades: [] };
const runSteps = (w, inputs, n) => {
  const evs = [];
  for (let i = 0; i < n; i++) {
    const inp = Array.isArray(inputs) ? (inputs[i] ?? {}) : {};
    for (const e of step(w, inp)) evs.push({ ...e, tick: w.tick });
  }
  return evs;
};
const byName = (evs, name) => evs.filter((e) => e.name === name);

test("P3-02: đèn hao dầu chính xác 1/60 mỗi tick, cạn dầu phát lantern_out & nhớ ever_lit", () => {
  const w = createWorld({
    seed: 1,
    scenario: { ...idle, lanterns: [{ id: "L1", pos: [0, 0, 25], lit: true, fuel: 2 }], time_left_s: 60 },
  });
  assert.equal(snapshot(w).lanterns[0].fuel, 2);
  const evs = runSteps(w, null, 120); // đúng 2 giây = 120 tick
  assert.equal(byName(evs, "lantern_out").length, 1);
  assert.deepEqual(byName(evs, "lantern_out")[0], { name: "lantern_out", data: { lantern_id: "L1" }, tick: 120 });
  const l1 = snapshot(w).lanterns[0];
  assert.equal(l1.lit, false);
  assert.equal(l1.fuel, 0);
  assert.equal(l1.deposited, 0);
  assert.equal(l1.ever_lit, true);
});

test("P3-03: châm dầu (refuel), đèn đầy bỏ qua, và thắp lại đèn ever_lit chỉ cần 5 đom đóm (+40)", () => {
  const w = createWorld({
    seed: 1,
    scenario: {
      ...idle,
      player: { pos: [0, 0, 24], carried: 10 },
      lanterns: [{ id: "L1", pos: [0, 0, 25], lit: true, fuel: 75 }],
      time_left_s: 60,
    },
  });
  // tick 1: fuel giảm 1/60 → ~74.983 → ceil((100-74.983)/10) = 3 đom đóm → đầy 100
  const ev1 = runSteps(w, [{ interact: true }, { interact: false }], 2);
  const ref = byName(ev1, "refuel");
  assert.equal(ref.length, 1);
  assert.deepEqual(ref[0].data, { lantern_id: "L1", amount: 3, fuel: 100 });
  assert.equal(w.score, 15); // 3 × +5
  assert.equal(w.player.carried, 7);

  // Thắp lại đèn ever_lit=true: chỉ cần 5 đom đóm, +5*5 + 40 = +65
  const w2 = createWorld({
    seed: 1,
    scenario: {
      ...idle,
      player: { pos: [0, 0, 24], carried: 6 },
      lanterns: [{ id: "L1", pos: [0, 0, 25], lit: false, ever_lit: true }],
      time_left_s: 60,
    },
  });
  const ev2 = runSteps(w2, [{ interact: true }], 1);
  assert.deepEqual(byName(ev2, "lantern_lit")[0].data, { lantern_id: "L1", relight: true });
  assert.equal(w2.player.carried, 1);
  assert.equal(w2.score, 65); // 5×5 + 40
  assert.equal(snapshot(w2).lanterns[0].relit_count, 1);
});

test("P3-04: Bóng Mực wander chọn đèn fuel < 30 → drain 5/s, phát fuel_drain mỗi 60t, pulse lúc drain +15", () => {
  const w = createWorld({
    seed: 1,
    scenario: {
      ...idle,
      player: { pos: [0, 0, 21], carried: 5 },
      lanterns: [{ id: "L1", pos: [0, 0, 25], lit: true, fuel: 25 }],
      shades: [{ id: "S1", pos: [0, 1, 25.5], state: "drain", target_lantern_id: "L1" }],
      time_left_s: 60,
    },
  });
  // Người chơi cách S1 4.5 m ≤ 6 m nên đặt xa hơn để test drain 60 tick trước
  w.player.z = 10;
  const evs = runSteps(w, null, 60);
  const fd = byName(evs, "fuel_drain");
  assert.equal(fd.length, 1);
  assert.equal(fd[0].tick, 60);
  assert.equal(fd[0].data.lantern_id, "L1");
  assert.equal(fd[0].data.shade_id, "S1");
  assert.equal(fd[0].data.fuel, 19); // 25 − 1 (hao) − 5 (hút) = 19

  // Di chuyển lại gần (dist 3 m) và Pulse ngay khi đang drain → +15 điểm
  w.player.z = 22.5;
  const scoreBefore = w.score;
  const pev = runSteps(w, [{ pulse: true }], 1);
  assert.deepEqual(byName(pev, "pulse")[0].data, { stunned_ids: ["S1"] });
  assert.equal(w.score - scoreBefore, 15);
  assert.equal(w.shades[0].state, "stunned");
});

test("P3-05: luật thắng dawn_survived (≥3/5 đèn sáng + thưởng 50+floor(fuel) + 50/flame) vs thua dawn", () => {
  const w = createWorld({
    seed: 1,
    scenario: {
      ...idle,
      player: { flames: 2 },
      lanterns: [
        { id: "L1", lit: true, fuel: 80 },
        { id: "L2", lit: true, fuel: 50 },
        { id: "L3", lit: true, fuel: 20 },
      ],
      time_left_s: 1,
    },
  });
  const evs = runSteps(w, null, 60);
  assert.equal(w.state, "won");
  assert.deepEqual(byName(evs, "game_over")[0].data, { result: "won", reason: "dawn_survived" });
  // Sau 1 s: fuel còn 79, 49, 19 → thưởng đèn = (50+79)+(50+49)+(50+19) = 297; flames = 2*50 = 100 → tổng 397
  assert.equal(w.score, 397);

  // Chỉ 2/5 đèn sáng → thua dawn
  const wLose = createWorld({
    seed: 1,
    scenario: {
      ...idle,
      lanterns: [
        { id: "L1", lit: true, fuel: 80 },
        { id: "L2", lit: true, fuel: 80 },
      ],
      time_left_s: 1,
    },
  });
  const evL = runSteps(wLose, null, 60);
  assert.equal(wLose.state, "lost");
  assert.deepEqual(byName(evL, "game_over")[0].data, { result: "lost", reason: "dawn" });
});

test("P3-06: sức chứa tăng dần 10 + 2*successful_lights (tối đa 20), scenario lit không tính", () => {
  const w = createWorld({
    seed: 1,
    scenario: {
      ...idle,
      player: { pos: [0, 0, 24], carried: 10, successful_lights: 4 },
      lanterns: [
        { id: "L1", pos: [0, 0, 25], lit: false },
        { id: "L2", lit: true },
      ],
      time_left_s: 60,
    },
  });
  assert.equal(snapshot(w).player.capacity, 18); // 10 + 2*4
  runSteps(w, [{ interact: true }], 1); // thắp L1 → successful_lights = 5 → capacity = 20
  assert.equal(snapshot(w).player.capacity, 20);
});
