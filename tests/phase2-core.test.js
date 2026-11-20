// Test logic core cho tính năng mới Test Contract v1.1 (Phase 2 — TICKET-02 Phần 3/4).
// Mỗi tính năng mới có thêm 1 scenario headless riêng trong tests/phase2-scenarios.test.js.
import { test } from "node:test";
import assert from "node:assert/strict";
import { CONTRACT, TUNING as T } from "../src/core/config.js";
import { getGroundY, resolveObstacles, MAPS } from "../src/core/maps.js";
import { createWorld, step, snapshot } from "../src/core/world.js";

const byName = (evs, name) => evs.filter((e) => e.name === name);
const runSteps = (w, inputs, ticks) => {
  const evs = [];
  for (let t = 1; t <= ticks; t++) {
    for (const e of step(w, inputs?.[t - 1] ?? {})) evs.push({ tick: t, ...e });
    if (w.state !== "playing") break;
  }
  return evs;
};
const idle = { random_motes: false, random_shades: false, motes: [], shades: [] };

// ── AC-01: Contract v1.2 (cập nhật từ v1.1 theo TICKET-03) ───────────────
test("AC-01: contract_version 1.2 + đủ số chuẩn Ticket-02 & Ticket-03", () => {
  assert.equal(CONTRACT.contract_version, "1.2");
  assert.equal(T.player_speed, 6.0);
  assert.equal(T.dash_speed, 14.0);
  assert.equal(T.night1_duration_s, 240);
  assert.equal(T.night2_duration_s, 270);
  assert.equal(T.night3_duration_s, 300);
  assert.equal(T.fuel_max, 100);
  assert.equal(T.fuel_decay_per_s, 1.0);
  assert.equal(T.fuel_per_mote, 10);
  assert.equal(T.relight_cost, 5);
  assert.equal(T.win_ratio, 0.6);
  assert.equal(T.drain_per_s, 5);
  assert.equal(T.low_fuel_threshold, 30);
  assert.equal(T.capacity_max, 20);
  assert.equal(T.score.per_mote, 5);
  assert.equal(T.score.per_lantern, 100);
  assert.equal(T.score.per_second_left, 0);
});

// ── AC-02: Lướt (dash) ──────────────────────────────────────────────────
test("AC-02: dash 14 m/s trong 12 tick, hướng di chuyển, cd 1.5 s, nhấn trong cd bị bỏ qua", () => {
  const w = createWorld({ seed: 1, scenario: { ...idle, time_left_s: 30 } });
  const inputs = Array(120).fill({ move: [1, 0], cam_yaw_deg: 0 });
  inputs[60] = { move: [1, 0], dash: true }; // kích hoạt ở tick 61
  inputs[61] = { move: [1, 0], dash: false };
  inputs[65] = { move: [1, 0], dash: true }; // đang lướt → bị bỏ qua
  inputs[66] = { move: [1, 0], dash: false };
  inputs[100] = { move: [1, 0], dash: true }; // còn cooldown → bị bỏ qua
  inputs[101] = { move: [1, 0], dash: false };
  const evs = runSteps(w, inputs, 120);
  const dashes = byName(evs, "dash");
  assert.equal(dashes.length, 1);
  assert.equal(dashes[0].tick, 61);
  const s61 = snapshot(w); // tick 120 snapshot — dùng sự kiện + vị trí cuối để kiểm
  // 60 tick × 0.1 + 12 tick × 14/60 + 48 tick × 0.1 = 6 + 2.8 + 4.8 = 13.6
  assert.ok(Math.abs(s61.player.pos[0] - 13.6) < 1e-6, `x=${s61.player.pos[0]}`);
});

test("AC-02: dash khi đứng yên theo hướng quay mặt; dash giữa không trung giữ độ cao", () => {
  const w = createWorld({ seed: 1, scenario: { ...idle, time_left_s: 30 } });
  runSteps(w, [{ jump: true }, { jump: false }], 1); // tick 1: nhảy vy=7
  const evs = runSteps(w, [{ dash: true }, { dash: false }], 1); // tick 2: dash hướng +Z (yaw 0)
  assert.equal(byName(evs, "dash").length, 1);
  assert.equal(w.player.dashTicks, 11); // còn 11 tick lướt
  assert.equal(w.player.vy, 0); // giữ nguyên độ cao
  const y0 = w.player.y;
  step(w, {});
  assert.equal(w.player.y, y0); // y không đổi trong lúc lướt
  assert.ok(Math.abs(w.player.z - (14 / 60) * 2) < 1e-9);
  assert.equal(w.player.dashCd, 89); // 90 - 1 tick sau khi đã chạy thêm 1 bước
});

test("AC-02: đang lướt vẫn bị Bóng Mực chạm (không bất tử khi lướt)", () => {
  const w = createWorld({
    seed: 1,
    scenario: { ...idle, player: { carried: 0, flames: 2 }, shades: [{ pos: [0.4, 1, 0] }], time_left_s: 30 },
  });
  const evs = runSteps(w, [{ dash: true }, { dash: false }], 2);
  const hits = byName(evs, "player_hit");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].data.by, "shade");
});

// ── AC-03: Rơi khỏi đảo ────────────────────────────────────────────────
test("AC-03: rơi Y<-10 → -1 lửa, mất hết đom đóm, chờ 60 tick hồi sinh + invuln 90", () => {
  const w = createWorld({
    seed: 1,
    scenario: { ...idle, player: { pos: [0, 0, 39.5], carried: 4 } },
  });
  const evs = runSteps(w, Array(100).fill({ move: [0, 1], cam_yaw_deg: 0 }), 100);
  const falls = byName(evs, "player_hit").filter((e) => e.data.by === "fall");
  assert.equal(falls.length, 1);
  assert.equal(falls[0].tick, 66); // đi tiếp 0.5 m rồi rơi ~60 tick tới Y<-10
  assert.deepEqual(falls[0].data, { by: "fall", flames: 2, lost: 4 });
  assert.equal(w.player.carried, 0);
  // đang trong 60 tick chờ hồi sinh: đứng yên dưới đáy, chưa về điểm xuất phát
  assert.ok(w.player.y < 0);
  assert.ok(w.player.z > 40);
  runSteps(w, null, 40); // hồi sinh tại tick 126 (66+60), đi tiếp tới tick 140
  assert.equal(w.player.grounded, true);
  assert.ok(Math.abs(w.player.z - 1.5) < 1e-6, `z=${w.player.z}`); // 15 tick × 0.1 m sau hồi sinh
  assert.equal(w.player.invuln, 76); // 90 tick bất tử từ hồi sinh, đã trôi 14 tick
  assert.equal(w.player.flames, 2);
});

test("AC-03: rơi khi còn 1 Ngọn Lửa → thua no_flames ngay, không hồi sinh", () => {
  const w = createWorld({
    seed: 1,
    scenario: { ...idle, player: { pos: [0, 0, 39.5], flames: 1 } },
  });
  const evs = runSteps(w, Array(80).fill({ move: [0, 1] }), 80);
  assert.equal(w.state, "lost");
  assert.deepEqual(byName(evs, "game_over")[0].data, { result: "lost", reason: "no_flames" });
});

// ── AC-04: Tạm dừng ────────────────────────────────────────────────────
test("AC-04: pause → tick tăng nhưng sim_tick/thời gian đứng yên, snapshot state=paused", () => {
  const w = createWorld({ seed: 1, scenario: { ...idle } });
  runSteps(w, Array(10).fill({}), 10); // simTick 10
  const evs1 = step(w, { pause: true }); // tick 11: paused
  assert.deepEqual(byName(evs1, "paused")[0]?.name, "paused");
  assert.equal(snapshot(w).state, "paused");
  assert.equal(w.tick, 11);
  assert.equal(w.simTick, 10);
  runSteps(w, Array(20).fill({ pause: false }), 20); // đứng yên 20 tick đồng hồ (nhả phím pause)
  const s30 = snapshot(w);
  assert.equal(s30.state, "paused");
  assert.equal(s30.tick, 31);
  assert.equal(s30.sim_tick, 10);
  assert.equal(s30.time_left_s, 239.833); // thời gian Đêm 1 = 240 s (Ticket-03), không trôi khi paused
  const evs2 = step(w, { pause: true }); // tick 32: resumed → chạy tiếp tick này
  assert.equal(byName(evs2, "resumed").length, 1);
  assert.equal(w.simTick, 11);
  assert.equal(snapshot(w).state, "playing");
});

// ── AC-05: 5 trạng thái Bóng Mực ───────────────────────────────────────
test("AC-05: spawning→wander, stunned hết 120t→chase, chase gây hit→recoil 60t lùi 2 m", () => {
  const w = createWorld({
    seed: 1,
    scenario: {
      ...idle,
      shades: [
        { id: "S1", pos: [30, 1, 0], state: "spawning", state_ticks_left: 30 },
        { id: "S2", pos: [6, 1, 0], state: "stunned", state_ticks_left: 120 },
      ],
      time_left_s: 30,
    },
  });
  assert.equal(w.shades[0].state, "spawning");
  assert.equal(w.shades[1].state, "stunned");
  const sx0 = w.shades[1].x;
  runSteps(w, null, 30);
  assert.equal(w.shades[0].state, "wander"); // spawning 30 tick → wander (dist 30 > 12)
  assert.equal(w.shades[1].state, "stunned");
  runSteps(w, null, 95); // tới tick 125: stun hết (120 tick từ tick 1)
  assert.equal(w.shades[1].state, "chase"); // dist ≤ 12 → chase
  const hits = runSteps(w, null, 100); // tới tick 225: đã bị chạm
  const hit = byName(hits, "player_hit").find((e) => e.data.by === "shade");
  assert.ok(hit, "phải bị chạm");
  assert.equal(w.shades[1].state, "recoil");
  assert.ok(w.shades[1].x > 1.0, "bóng lùi ra xa Mây sau hit");
});

// ── AC-06: Tỏa Sáng chuẩn v1.1 ─────────────────────────────────────────
test("AC-06: pulse 3D từ y+0.8, đủ 3 đom đóm mới kích hoạt", () => {
  const w = createWorld({ seed: 1, scenario: { ...idle, player: { carried: 5 }, shades: [{ pos: [4, 1, 0] }] } });
  const evs = runSteps(w, [{ pulse: true }, { pulse: false }], 1);
  assert.equal(byName(evs, "pulse").length, 1);
  assert.equal(w.player.carried, 2);
  const s = snapshot(w);
  assert.equal(s.player.pulse_cd_s, 3.0);
  assert.ok(Math.abs(s.shades[0].pos[0] - (4 + 4 / 15)) < 1e-3); // snapshot làm tròn 3 số lẻ
});

test("AC-06: < 3 đom đóm → không kích hoạt, không tốn cd", () => {
  const w = createWorld({ seed: 1, scenario: { ...idle, player: { carried: 2 }, shades: [{ pos: [4, 1, 0] }] } });
  const evs = runSteps(w, [{ pulse: true }, { pulse: false }], 2);
  assert.equal(byName(evs, "pulse").length, 0);
  assert.equal(w.player.carried, 2);
  assert.equal(w.player.pulseCd, 0);
});

// ── AC-07/AC-08: Bản đồ chuẩn Đêm 2 & Đêm 3 ────────────────────────────
test("AC-07: Đêm 2 — 2 đảo + cầu tre; getGroundY đúng ranh giới", () => {
  assert.equal(getGroundY(2, 0, 0, 0), 0); // đảo A
  assert.equal(getGroundY(2, 70, 0, 0), 0); // đảo B
  assert.equal(getGroundY(2, 35, 0, 0), 0); // giữa cầu
  assert.equal(getGroundY(2, 35, 1.9, 0), 0); // cầu z ≤ 2
  assert.equal(getGroundY(2, 35, 2.1, 0), -Infinity); // ngoài cầu
  assert.equal(getGroundY(2, 29, 20, 0), -Infinity); // ngoài 2 đảo
  assert.equal(MAPS[2].lanterns.length, 6);
  assert.deepEqual(MAPS[2].lanterns.map((l) => l.id), ["L1", "L2", "L3", "L4", "L5", "L6"]);
});

test("AC-08: Đêm 3 — 3 tầng, dốc 30°/150°, tháp chuông chặn", () => {
  assert.equal(getGroundY(3, 40, 0, 0), 0); // tầng 0
  assert.equal(getGroundY(3, 16, 10, 3), 3); // tầng 1 (r=18.9, z>0)
  assert.equal(getGroundY(3, 16, 10, 0), 0); // đứng ở Y=0 thì mặt cao ≤ 0.5 là tầng 0
  assert.equal(getGroundY(3, 5, -5, 6), 6); // tầng 2 (z<0 vẫn là đĩa tâm)
  assert.equal(getGroundY(3, 0, 47, 0), -Infinity); // ngoài đảo
  // dốc 30°: điểm r=27 đúng hướng 30° → Y = 3·(30−27)/6 = 1.5
  const p = { x: 27 * Math.cos(Math.PI / 6), z: 27 * Math.sin(Math.PI / 6), y: 1.5 };
  assert.ok(Math.abs(getGroundY(3, p.x, p.z, 1.5) - 1.5) < 1e-9);
  // tháp chuông: đẩy thực thể đứng trong trụ r<2 ở tầng 2 ra mép r=2
  const pos = resolveObstacles(3, { x: 1, y: 6, z: 0 });
  assert.ok(Math.abs(Math.hypot(pos.x, pos.z) - 2) < 1e-9);
  const pos0 = resolveObstacles(3, { x: 0, y: 6, z: 0 });
  assert.equal(pos0.x, 2); // trùng vị trí → đẩy +X
  assert.equal(resolveObstacles(3, { x: 1, y: 0, z: 0 }).x, 1); // tầng 0 không bị chặn
});

// ── AC-07: Bục nhảy Đêm 2 ──────────────────────────────────────────────
test("AC-07: chạm bục (20,0,18) → vy=14, ngang 24 m/s về đảo B, đáp trong đảo B", () => {
  const w = createWorld({
    seed: 2,
    night: 2,
    scenario: { ...idle, player: { pos: [20, 0, 18] } },
  });
  const evs = runSteps(w, Array(100).fill({ move: [0, -1] }), 100); // bơm input — không được ghi đè vận tốc phóng
  assert.equal(byName(evs, "player_hit").length, 0);
  assert.equal(w.player.grounded, true);
  assert.equal(w.player.y, 0);
  const dB = Math.hypot(w.player.x - 70, w.player.z);
  assert.ok(dB <= 28, `phải đáp trong đảo B (d=${dB})`);
  assert.ok(Math.abs(w.player.x - 51.2) < 1.0, `x=${w.player.x}`);
});

// ── AC-09: Gió Lạc ─────────────────────────────────────────────────────
test("AC-09: drifter chase → chạm cướp 3 → flee 240 tick → removed; pulse lúc flee → drop", () => {
  const w = createWorld({
    seed: 1,
    night: 2,
    scenario: {
      ...idle,
      player: { carried: 6 },
      drifters: [{ id: "D1", pos: [10, 1.2, 0], state: "chase" }],
      time_left_s: 30,
    },
  });
  const frames = Array(100).fill({});
  frames[79] = { pulse: true };
  frames[80] = { pulse: false };
  const evs = runSteps(w, frames, 100);
  const steal = byName(evs, "drifter_steal");
  assert.equal(steal.length, 1);
  assert.equal(steal[0].tick, 76); // 10 m ở 7 m/s → chạm ≤1.2 m tại tick 76
  assert.deepEqual(steal[0].data, { drifter_id: "D1", amount: 3, carried: 3 });
  const drop = byName(evs, "drifter_drop");
  assert.equal(drop.length, 1);
  assert.equal(drop[0].tick, 80);
  assert.deepEqual(drop[0].data, { drifter_id: "D1", amount: 3 });
  assert.equal(w.player.carried, 0); // pulse trừ 3
  const drops = w.motes.filter((m) => m.kind === "dropped");
  assert.equal(drops.length, 3);
  const s100 = snapshot(w);
  assert.equal(s100.drifters[0].state, "removed"); // còn nằm lại 120 tick sau khi bị pulse lúc flee
  assert.equal(s100.drifters[0].stolen, 0);
  runSteps(w, null, 130);
  assert.equal(w.drifters.length, 0); // đã biến mất
});

test("AC-09: sinh tự lịch tick 1200 (Đêm 2), tối đa 2 con; không cướp khi carried < 5", () => {
  const w = createWorld({ seed: 3, night: 2, scenario: { ...idle } });
  const evs = runSteps(w, null, 1210);
  assert.equal(w.drifters.length, 1);
  assert.equal(w.drifters[0].id, "D1");
  assert.equal(w.drifters[0].state, "idle"); // carried 0 < 5 → không chase
});

// ── AC-10: Bùa Gió ─────────────────────────────────────────────────────
test("AC-10: nhặt charm → 600 tick tốc độ 7.2, dash không cd; bùa hồi 2700 tick", () => {
  const w = createWorld({
    seed: 1,
    night: 2,
    scenario: { ...idle, charms: [{ id: "C1", pos: [3.5, 0, 0] }], time_left_s: 60 },
  });
  const frames = Array(120).fill({ move: [1, 0], cam_yaw_deg: 0 });
  frames[30] = { move: [1, 0], dash: true };
  frames[31] = { move: [1, 0], dash: false };
  frames[45] = { move: [1, 0], dash: true };
  frames[46] = { move: [1, 0], dash: false };
  const evs = runSteps(w, frames, 120);
  const picked = byName(evs, "charm_picked");
  assert.equal(picked.length, 1);
  assert.ok(picked[0].tick === 25 || picked[0].tick === 26, `tick=${picked[0].tick}`); // dist ≤ 1 (biên float)
  assert.equal(picked[0].data.charm_ticks, 600);
  // 2 lần dash liên tiếp (ticks 31, 46) đều thành công — không hồi chiêu khi có bùa
  assert.equal(byName(evs, "dash").length, 2);
  assert.equal(w.player.dashCd, 0);
  // tick 120: ~2.4 (chưa nhặt) + 2 dash (5.6) + đi thường/bùa → tổng trong khoảng 15–18 m
  assert.ok(w.player.x > 15 && w.player.x < 18, `x=${w.player.x}`);
  const s = snapshot(w);
  assert.equal(s.charms[0].available, false);
  assert.ok(s.charms[0].respawn_s > 0);
  assert.ok(s.player.charm_s > 0 && s.player.charm_s <= 10);
});

test("AC-10: bùa hồi lại đúng sau 2700 tick", () => {
  const w = createWorld({
    seed: 1,
    night: 2,
    scenario: { ...idle, charms: [{ id: "C1", pos: [0.5, 0, 0] }], time_left_s: 60 },
  });
  runSteps(w, [{}], 1); // tick 1: nhặt C1 (dist 0.5)
  assert.equal(w.charms[0].available, false);
  assert.equal(w.charms[0].respawn, 2700);
  // Đi ra xa C1 để không tự nhặt lại ngay khi bùa hồi ở tick 2701
  runSteps(w, Array(20).fill({ move: [-1, 0], cam_yaw_deg: 0 }), 20);
  runSteps(w, Array(2680).fill({ move: [0, 0] }), 2680); // đủ 2700 tick hồi bùa
  assert.equal(w.charms[0].available, true);
  assert.equal(w.charms[0].respawn, 0);
  assert.equal(w.player.charmTicks, 0); // hiệu lực 600 tick đã hết từ lâu
});

// ── Gió mạnh Đêm 3 (A2-9) ──────────────────────────────────────────────
test("A2-9: gió bật tick 1800..2099 mỗi chu kỳ 1800, đẩy 2 m/s, wind.active trong snapshot", () => {
  const w = createWorld({ seed: 5, night: 3, scenario: { ...idle, player: { pos: [0, 0, -30] } } });
  runSteps(w, null, 1700);
  assert.equal(w.windActive, false);
  runSteps(w, null, 150); // tới tick 1850
  assert.equal(w.windActive, true);
  assert.ok(w.windDirDeg >= 0 && w.windDirDeg < 360);
  const xBefore = w.player.x;
  const zBefore = w.player.z;
  runSteps(w, null, 100); // 100 tick gió (~1.67 s × 2 m/s ≈ 3.3 m)
  const moved = Math.hypot(w.player.x - xBefore, w.player.z - zBefore);
  assert.ok(moved > 0.1, `bị gió đẩy (d=${moved})`);
  const s = snapshot(w);
  assert.equal(s.wind.active, true);
  runSteps(w, null, 300); // hết cơn gió (tick 2100+)
  assert.equal(w.windActive, false);
});

// ── AC-08: Đêm 3 leo dốc + bục nhảy lên tầng 2 ─────────────────────────
test("AC-08: leo dốc 30° lên tầng 1 Y=3, bục (0,3,13) phóng lên tầng 2 Y=6", () => {
  const w = createWorld({
    seed: 1,
    night: 3,
    scenario: { ...idle, player: { pos: [25.1146, 0.5, 14.5] } }, // giữa dốc 30° tại r=29
  });
  const up = Array(55).fill({ move: [-0.8660254, -0.5], cam_yaw_deg: 0 });
  runSteps(w, up, 55); // đi 5.5 m dọc dốc: r 29→23.5 → lên hẳn tầng 1
  assert.equal(w.player.y, 3);
  assert.equal(w.player.grounded, true);
  // từ đỉnh dốc (20.35, 11.75) đi về bục (0,3,13) (~20.4 m), phóng và đáp ~tick 300
  const toPad = Array(260).fill({ move: [-0.9986, 0.0507], cam_yaw_deg: 0 });
  runSteps(w, toPad, 260); // tới tick 315 — đã phóng (≈tick 249) và đáp (≈tick 300)
  assert.ok(w.player.grounded, "phải đã đáp");
  assert.equal(w.player.y, 6); // tầng 2
  const r = Math.hypot(w.player.x, w.player.z);
  assert.ok(r <= 8, `phải đáp trong tầng 2 (r=${r})`);
  assert.ok(r >= 1.9, "không nằm trong tháp chuông (bị đẩy ra r≥2)");
});
