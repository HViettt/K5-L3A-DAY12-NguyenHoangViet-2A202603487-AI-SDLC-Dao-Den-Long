// Logic game thuần Đảo Đèn Lồng – Phase 1.
// Luật G1–G16: docs/notes/phase-1.md; Test Contract v1.0: docs/spec/prd-0.md.
// Thuần: không import three, không DOM, không Date.now/Math.random — ngẫu nhiên chỉ qua rng.js.
import { createRng } from "./rng.js";
import { TUNING as T, LAWS, TICKS_PER_SECOND, DT } from "./config.js";

const r3 = (v) => {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
};
const distXZ = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const num = (id) => Number.parseInt(id.slice(1), 10);

function defaultLanterns() {
  const out = [];
  for (let k = 1; k <= T.lantern_count_night1; k++) {
    const a = ((k - 1) * 72 * Math.PI) / 180; // G2: Lk ở góc (k−1)·72°
    out.push({
      id: `L${k}`,
      x: LAWS.lanternRingRadius * Math.sin(a),
      y: 0,
      z: LAWS.lanternRingRadius * Math.cos(a),
      lit: false,
      deposited: 0,
    });
  }
  return out;
}

// Dựng scenario (contract mục D): không phát sự kiện, không cộng điểm.
function applyScenario(w, sc) {
  if (!sc || typeof sc !== "object") return;
  const p = sc.player ?? {};
  if (p.pos) {
    w.player.x = p.pos[0];
    w.player.y = p.pos[1];
    w.player.z = p.pos[2];
  }
  if (p.carried !== undefined) w.player.carried = p.carried;
  if (p.flames !== undefined) w.player.flames = p.flames;
  if (sc.random_motes !== undefined) w.randomMotes = !!sc.random_motes;
  if (sc.random_shades !== undefined) w.randomShades = !!sc.random_shades;
  if (sc.motes !== undefined) {
    // Thay thế danh sách ban đầu; gán id M1… theo thứ tự (G12).
    w.motes = sc.motes.map((pos, i) => ({ id: `M${i + 1}`, x: pos[0], z: pos[2] }));
    w.scenarioMotes = true;
  }
  if (sc.shades !== undefined) {
    // Thay thế danh sách ban đầu; không có id thì đánh S1… theo thứ tự (G12).
    w.shades = sc.shades.map((s, i) => makeShade(s.id ?? `S${i + 1}`, s.pos));
    w.scenarioShades = true;
  }
  if (sc.lanterns !== undefined) {
    for (const l of sc.lanterns) {
      const cur = w.lanterns.find((x) => x.id === l.id);
      if (!cur) continue;
      if (l.pos) {
        cur.x = l.pos[0];
        cur.y = l.pos[1];
        cur.z = l.pos[2];
      }
      if (l.deposited !== undefined) cur.deposited = l.deposited;
      if (l.lit !== undefined) cur.lit = !!l.lit;
    }
  }
  if (sc.time_left_s !== undefined) {
    w.budgetTicks = Math.round(sc.time_left_s * TICKS_PER_SECOND);
  }
  // Id tự sinh tiếp nối số lớn nhất hiện có (G12).
  w.nextMote = w.motes.length + 1;
  w.nextShade = w.shades.reduce((m, s) => Math.max(m, num(s.id)), 0) + 1;
}

// Timer đếm bằng TICK nguyên (không float) để tất định tuyệt đối giữa các bước:
// invuln/cooldown/stun tính bằng giây từ tuning, quy đổi sang số tick.
const ticksOf = (s) => Math.round(s * TICKS_PER_SECOND);

function makeShade(id, pos) {
  return { id, x: pos[0], y: pos[1], z: pos[2], state: "chase", stunTicks: 0 };
}

function spawnRandomMote(w) {
  const r = LAWS.randomMoteMinRadius + w.rng() * (LAWS.islandRadius - LAWS.randomMoteMinRadius);
  const a = w.rng() * Math.PI * 2;
  w.motes.push({ id: `M${w.nextMote++}`, x: r * Math.sin(a), z: r * Math.cos(a) });
}

function spawnRandomShade(w, events) {
  const a = w.rng() * Math.PI * 2; // sinh ở mép đảo (bán kính 40), góc ngẫu nhiên
  const s = makeShade(`S${w.nextShade++}`, [
    LAWS.islandRadius * Math.sin(a),
    0,
    LAWS.islandRadius * Math.cos(a),
  ]);
  w.shades.push(s);
  if (events) events.push({ name: "shade_spawned", data: { id: s.id } });
}

export function timeLeftS(w) {
  // G13/R2: time_left_s = duration − steps/60, tính từ số bước nguyên (không cộng dồn float).
  return (w.budgetTicks - w.tick) / TICKS_PER_SECOND;
}

export function createWorld({ seed = 1, scenario = {} } = {}) {
  const w = {
    seed,
    rng: createRng(seed),
    tick: 0,
    state: "playing",
    score: 0,
    budgetTicks: Math.round(T.night1_duration_s * TICKS_PER_SECOND),
    player: { x: 0, y: 0, z: 0, vy: 0, grounded: true, carried: 0, flames: T.flames, invuln: 0 },
    // invuln ở đây là số tick bất tử còn lại (0 = hết bất tử)
    lanterns: defaultLanterns(),
    shades: [],
    motes: [],
    randomMotes: true,
    randomShades: true,
    scenarioMotes: false,
    scenarioShades: false,
    cooldown: 0,
    // Trạng thái input trước đó để phát hiện cạnh lên (contract mục C).
    last: { move: [0, 0], yaw: 0, jump: false, interact: false, pulse: false },
    nextMote: 1,
    nextShade: 1,
  };
  applyScenario(w, scenario ?? {});
  // G11: sinh ban đầu chỉ khi random bật và scenario không thay thế danh sách tương ứng.
  if (w.randomMotes && !w.scenarioMotes) {
    for (let i = 0; i < LAWS.randomMoteTarget; i++) spawnRandomMote(w);
  }
  if (w.randomShades && !w.scenarioShades) {
    for (let i = 0; i < LAWS.randomShadeStart; i++) spawnRandomShade(w, null);
  }
  return w;
}

// Một bước mô phỏng: input tick k → trạng thái k+1; trả về các sự kiện của bước (tick = k+1).
export function step(w, input = {}) {
  const events = [];
  if (w.state !== "playing") return events;
  w.tick += 1;
  const t = w.tick;
  const prev = w.last;
  const cur = {
    move: input.move !== undefined ? input.move : prev.move,
    yaw:
      input.cam_yaw_deg !== undefined
        ? (input.cam_yaw_deg * Math.PI) / 180
        : prev.yaw,
    jump: input.jump !== undefined ? !!input.jump : prev.jump,
    interact: input.interact !== undefined ? !!input.interact : prev.interact,
    pulse: input.pulse !== undefined ? !!input.pulse : prev.pulse,
  };
  w.last = cur;
  const p = w.player;

  // 2. Di chuyển + nhảy người chơi (G3, G4)
  let mx = cur.move[0];
  let mz = cur.move[1];
  const len = Math.hypot(mx, mz);
  if (len > 1) {
    mx /= len;
    mz /= len;
  }
  const cos = Math.cos(cur.yaw);
  const sin = Math.sin(cur.yaw);
  const vx = mx * cos + mz * sin; // công thức xoay camera của contract mục C
  const vz = -mx * sin + mz * cos;
  p.x += vx * T.player_speed * DT;
  p.z += vz * T.player_speed * DT;
  // G1: fall_enabled=false — giữ người chơi ở mép đảo (clamp theo XZ)
  const pd = Math.hypot(p.x, p.z);
  if (pd > LAWS.islandRadius) {
    const s = LAWS.islandRadius / pd;
    p.x *= s;
    p.z *= s;
  }
  // G4: nhảy (không né va chạm — mọi khoảng cách đo XZ)
  if (cur.jump && !prev.jump && p.grounded) {
    p.vy = LAWS.jumpVy;
    p.grounded = false;
  }
  if (!p.grounded) {
    p.y += p.vy * DT;
    p.vy -= LAWS.gravity * DT;
    if (p.y <= 0) {
      p.y = 0;
      p.vy = 0;
      p.grounded = true;
    }
  }

  // 3. Tỏa sáng (G7)
  if (cur.pulse && !prev.pulse && p.carried >= T.pulse_cost && w.cooldown <= 0) {
    p.carried -= T.pulse_cost;
    w.cooldown = ticksOf(T.pulse_cooldown_s);
    const ids = [];
    for (const s of w.shades) {
      const d = distXZ(s.x, s.z, p.x, p.z);
      if (d <= T.pulse_radius) {
        s.state = "stunned";
        s.stunTicks = ticksOf(T.pulse_stun_s);
        let dx;
        let dz;
        if (d === 0) {
          dx = 1; // trùng vị trí: đẩy theo +X
          dz = 0;
        } else {
          dx = (s.x - p.x) / d;
          dz = (s.z - p.z) / d;
        }
        s.x += dx * T.pulse_push_m;
        s.z += dz * T.pulse_push_m;
        ids.push(s.id);
      }
    }
    ids.sort((a, b) => num(a) - num(b));
    events.push({ name: "pulse", data: { stunned_ids: ids } });
    w.score += T.score.per_stun * ids.length;
  }

  // 4. Nạp đèn (G6)
  if (cur.interact && !prev.interact && p.carried > 0) {
    let best = null;
    let bestD = Infinity;
    for (const l of w.lanterns) {
      if (l.lit) continue;
      const d = distXZ(l.x, l.z, p.x, p.z);
      if (
        d <= T.interact_radius &&
        (best === null || d < bestD || (d === bestD && num(l.id) < num(best.id)))
      ) {
        best = l;
        bestD = d;
      }
    }
    if (best) {
      const amount = Math.min(p.carried, T.lantern_cost - best.deposited);
      if (amount > 0) {
        p.carried -= amount;
        best.deposited += amount;
        events.push({
          name: "deposit",
          data: { lantern_id: best.id, amount, deposited: best.deposited },
        });
        if (best.deposited >= T.lantern_cost) {
          best.lit = true;
          events.push({ name: "lantern_lit", data: { lantern_id: best.id } });
          w.score += T.score.per_lantern;
        }
      }
    }
  }

  // 5. Nhặt đom đóm (G5) — tự động, theo thứ tự trong danh sách (id tăng dần)
  for (let i = 0; i < w.motes.length && p.carried < T.carry_capacity; ) {
    const m = w.motes[i];
    if (distXZ(m.x, m.z, p.x, p.z) <= T.pickup_radius) {
      w.motes.splice(i, 1);
      p.carried += 1;
      w.score += T.score.per_mote;
      events.push({ name: "mote_picked", data: { carried: p.carried } });
    } else {
      i += 1;
    }
  }

  // 6. Bóng Mực di chuyển + vùng an toàn (G8, G9)
  for (const s of w.shades) {
    if (s.state === "chase") {
      const dx = p.x - s.x;
      const dz = p.z - s.z;
      const d = Math.hypot(dx, dz);
      if (d > 0) {
        s.x += (dx / d) * T.shade_speed * DT;
        s.z += (dz / d) * T.shade_speed * DT;
      }
    }
    // G9: không vào được trong safe_radius quanh đèn ĐÃ THẮP (trừ đúng mép)
    let bestL = null;
    let bestD = Infinity;
    for (const l of w.lanterns) {
      if (!l.lit) continue;
      const d = distXZ(s.x, s.z, l.x, l.z);
      if (d < T.safe_radius && d < bestD) {
        bestL = l;
        bestD = d;
      }
    }
    if (bestL) {
      let dx = s.x - bestL.x;
      let dz = s.z - bestL.z;
      const d = Math.hypot(dx, dz);
      if (d === 0) {
        dx = 1;
        dz = 0;
      } else {
        dx /= d;
        dz /= d;
      }
      s.x = bestL.x + dx * T.safe_radius;
      s.z = bestL.z + dz * T.safe_radius;
    }
  }

  // 7. Va chạm (G10) — tối đa 1 lần chạm mỗi tick
  if (p.invuln <= 0) {
    for (const s of w.shades) {
      if (s.state !== "stunned" && distXZ(s.x, s.z, p.x, p.z) <= T.shade_hit_radius) {
        p.flames -= 1;
        const dropped = Math.floor(p.carried * T.hit_drop_ratio);
        p.carried -= dropped; // đom đóm rơi mất luôn
        p.invuln = ticksOf(T.invuln_s);
        events.push({
          name: "player_hit",
          data: { by: "shade", flames: p.flames, dropped },
        });
        break;
      }
    }
  }

  // 8. Giảm timer (stun, invuln, cooldown), time_left, sinh ngẫu nhiên (G8, G11)
  for (const s of w.shades) {
    if (s.state === "stunned") {
      s.stunTicks -= 1;
      if (s.stunTicks <= 0) {
        s.stunTicks = 0;
        s.state = "chase";
      }
    }
  }
  if (p.invuln > 0) p.invuln -= 1;
  if (w.cooldown > 0) w.cooldown -= 1;
  if (t % LAWS.randomMoteIntervalTicks === 0 && w.randomMotes && w.motes.length < LAWS.randomMoteTarget) {
    spawnRandomMote(w); // sinh đom đóm không phát sự kiện (contract không định nghĩa)
  }
  if (t % LAWS.randomShadeIntervalTicks === 0 && w.randomShades && w.shades.length < LAWS.randomShadeMax) {
    spawnRandomShade(w, events);
  }

  // 9. Kiểm tra thắng rồi thua (G13)
  if (w.lanterns.every((l) => l.lit)) {
    w.state = "won";
    const tl = timeLeftS(w);
    w.score += T.score.per_second_left * Math.floor(tl) + T.score.per_flame_left * p.flames;
    events.push({ name: "game_over", data: { result: "won", reason: "all_lit" } });
  } else if (p.flames <= 0) {
    w.state = "lost";
    events.push({ name: "game_over", data: { result: "lost", reason: "no_flames" } });
  } else if (timeLeftS(w) <= 0) {
    w.state = "lost";
    events.push({ name: "game_over", data: { result: "lost", reason: "dawn" } });
  }

  return events;
}

// Snapshot dùng cho output JSONL (contract mục E) — tọa độ làm tròn 3 chữ số.
export function snapshot(w) {
  return {
    tick: w.tick,
    sim_tick: w.tick,
    state: w.state,
    time_left_s: r3(timeLeftS(w)),
    score: w.score,
    player: {
      pos: [r3(w.player.x), r3(w.player.y), r3(w.player.z)],
      flames: w.player.flames,
      carried: w.player.carried,
    },
    lanterns: w.lanterns.map((l) => ({
      id: l.id,
      pos: [r3(l.x), r3(l.y), r3(l.z)],
      lit: l.lit,
      deposited: l.deposited,
    })),
    shades: w.shades.map((s) => ({
      id: s.id,
      pos: [r3(s.x), r3(s.y), r3(s.z)],
      state: s.state,
    })),
    motes_active: w.motes.length,
    motes: w.motes.map((m) => ({ id: m.id, pos: [r3(m.x), 0, r3(m.z)] })),
  };
}
