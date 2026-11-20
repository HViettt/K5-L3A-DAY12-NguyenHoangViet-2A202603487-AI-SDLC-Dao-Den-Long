// Logic game thuần Đảo Đèn Lồng – Phase 2 (Test Contract v1.1 — TICKET-02).
// Thứ tự 12 bước bắt buộc trong 1 tick: docs/spec/ticket-02.md Phần 1.
// Giả định đã chốt: docs/notes/phase-2.md (A2-1..A2-16).
// Thuần: không three, không DOM, không Date.now/Math.random — ngẫu nhiên chỉ qua rng.js.
import { createRng } from "./rng.js";
import { TUNING as T, TICKS_PER_SECOND, DT, LAWS } from "./config.js";
import { MAPS, getGroundY, resolveObstacles } from "./maps.js";

const r3 = (v) => {
  const r = Math.round(v * 1000) / 1000;
  return Object.is(r, -0) ? 0 : r;
};
const distXZ = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz);
const num = (id) => Number.parseInt(id.slice(1), 10);
const rad = (deg) => (deg * Math.PI) / 180;
// Timer đếm bằng TICK nguyên (không float) để tất định tuyệt đối giữa các bước.
const ticksOf = (s) => Math.round(s * TICKS_PER_SECOND);
const groundAt = (w, x, z, cy) => getGroundY(w.night, x, z, cy);

function makeMote(id, x, y, z, kind, ttlTicks, pickAt) {
  return { id, x, y, z, kind, ttl: ttlTicks, pickAt };
}

function makeShade(id, pos, state = "wander") {
  return {
    id,
    x: pos[0],
    y: pos[1],
    z: pos[2],
    state,
    stateTicks: LAWS.shadeSpawningTicks, // dành cho spawning (A2-4)
    stunTicks: 0,
    recoilTicks: 0,
    pushTicks: 0,
    pushDX: 0,
    pushDZ: 0,
    wdx: 0,
    wdz: 0, // hướng wander hiện tại
  };
}

// A2-4/A2-6: hết spawning/stun/recoil → chase nếu ≤ 12 m, ngược lại wander (xoay hướng ngẫu nhiên).
function toWanderOrChase(w, s) {
  const p = w.player;
  if (distXZ(s.x, s.z, p.x, p.z) <= LAWS.shadeDetect) {
    s.state = "chase";
  } else {
    s.state = "wander";
    const a = w.rng() * Math.PI * 2;
    s.wdx = Math.cos(a);
    s.wdz = Math.sin(a);
  }
}

function makeDrifter(id, x, y, z) {
  return {
    id,
    x,
    y,
    z,
    state: "idle",
    stolen: 0,
    fleeTicks: 0,
    removeTicks: 0,
    cx: x,
    cz: z, // tâm tuần tra khi idle (A2-11)
    angle: 0,
  };
}

// Dựng scenario (contract v1.1 mục D): không phát sự kiện, không cộng điểm.
function applyScenario(w, sc) {
  if (!sc || typeof sc !== "object") return;
  const p = w.player;
  const P = sc.player ?? {};
  if (P.pos) {
    p.x = P.pos[0];
    p.y = P.pos[1];
    p.z = P.pos[2];
  }
  if (P.carried !== undefined) p.carried = P.carried;
  if (P.flames !== undefined) p.flames = P.flames;
  if (P.invuln_ticks !== undefined) p.invuln = P.invuln_ticks;
  if (P.dash_cd_ticks !== undefined) p.dashCd = P.dash_cd_ticks;
  if (P.pulse_cd_ticks !== undefined) p.pulseCd = P.pulse_cd_ticks;
  if (P.charm_ticks !== undefined) p.charmTicks = P.charm_ticks;
  if (sc.random_motes !== undefined) w.randomMotes = !!sc.random_motes;
  if (sc.random_shades !== undefined) w.randomShades = !!sc.random_shades;
  if (sc.random_drifters !== undefined) w.randomDrifters = !!sc.random_drifters;
  if (sc.wind_enabled !== undefined) w.windEnabled = !!sc.wind_enabled;
  if (sc.motes !== undefined) {
    // Thay thế danh sách ban đầu; gán id M1… theo thứ tự.
    w.motes = sc.motes.map((pos, i) => makeMote(`M${i + 1}`, pos[0], pos[1], pos[2], "random", null, 0));
    w.scenarioMotes = true;
  }
  if (sc.shades !== undefined) {
    // Thay thế danh sách ban đầu. A2-4: không ghi rõ state thì wander,
    // hoặc chase nếu cách người chơi ≤ 12 m.
    w.shades = sc.shades.map((s, i) => {
      const id = s.id ?? `S${i + 1}`;
      const st =
        s.state ??
        (distXZ(s.pos[0], s.pos[2], p.x, p.z) <= LAWS.shadeDetect ? "chase" : "wander");
      const sh = makeShade(id, s.pos, st);
      if (s.state_ticks_left !== undefined) {
        if (st === "spawning") sh.stateTicks = s.state_ticks_left;
        else if (st === "stunned") sh.stunTicks = s.state_ticks_left;
        else if (st === "recoil") sh.recoilTicks = s.state_ticks_left;
      }
      return sh;
    });
    w.scenarioShades = true;
  }
  if (sc.drifters !== undefined) {
    // Thay thế danh sách mặc định.
    w.drifters = sc.drifters.map((d, i) => {
      const dr = makeDrifter(d.id ?? `D${i + 1}`, d.pos[0], d.pos[1], d.pos[2]);
      if (d.state !== undefined) dr.state = d.state;
      if (d.stolen !== undefined) dr.stolen = d.stolen;
      return dr;
    });
    w.scenarioDrifters = true;
  }
  if (sc.charms !== undefined) {
    // Thay thế danh sách mặc định; vị trí mặc định tra theo id của bản đồ.
    w.charms = sc.charms.map((c, i) => {
      const id = c.id ?? `C${i + 1}`;
      const def = w.map.charms[num(id) - 1];
      const pos = c.pos ?? def ?? [0, 0, 0];
      return { id, x: pos[0], y: pos[1], z: pos[2], available: c.available !== false, respawn: 0 };
    });
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
  // Id tự sinh tiếp nối số lớn nhất hiện có.
  w.nextMote = w.motes.length + 1;
  w.nextShade = w.shades.reduce((m, s) => Math.max(m, num(s.id)), 0) + 1;
  w.nextDrifter = w.drifters.reduce((m, d) => Math.max(m, num(d.id)), 0) + 1;
}

// Chọn ngẫu nhiên (có seed) `count` điểm sinh đom đóm ban đầu trong các điểm của bản đồ.
function placeInitialMotes(w) {
  const pool = w.map.motePoints.slice();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(w.rng() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const n = Math.min(LAWS.moteInitial, pool.length);
  for (let i = 0; i < n; i++) {
    const pt = pool[i];
    w.motes.push(makeMote(`M${w.nextMote++}`, pt.x, pt.y, pt.z, "random", null, 0));
  }
}

export function timeLeftS(w) {
  // time_left_s = duration − simTick/60 (sim_tick đứng yên khi tạm dừng).
  return (w.budgetTicks - w.simTick) / TICKS_PER_SECOND;
}

export function createWorld({ seed = 1, night = 1, scenario = {} } = {}) {
  const map = MAPS[night] ?? MAPS[1];
  const w = {
    seed,
    night,
    map,
    rng: createRng(seed),
    tick: 0, // tick "đồng hồ tường": luôn tăng, cả khi paused
    simTick: 0, // tick mô phỏng: đứng yên khi paused
    state: "playing",
    paused: false,
    score: 0,
    budgetTicks: Math.round(map.duration_s * TICKS_PER_SECOND),
    shadeSpeed: night === 3 ? LAWS.shadeSpeedNight3 : T.shade_speed,
    player: {
      x: map.spawn[0],
      y: map.spawn[1],
      z: map.spawn[2],
      vx: 0,
      vy: 0,
      vz: 0,
      grounded: true,
      launch: false, // đang bay do bục nhảy phóng (giữ vận tốc tới khi chạm đất)
      launchVX: 0,
      launchVZ: 0,
      carried: 0,
      flames: T.flames,
      invuln: 0, // số tick bất tử còn lại
      dashCd: 0,
      pulseCd: 0,
      charmTicks: 0,
      dashTicks: 0,
      dashDX: 0,
      dashDZ: 1,
      waiting: false, // đang chờ hồi sinh sau khi rơi
      respawnWait: 0,
    },
    lanterns: map.lanterns.map((l) => ({ ...l, lit: false, deposited: 0 })),
    shades: [],
    motes: [],
    drifters: [],
    charms: map.charms.map((c, i) => ({
      id: `C${i + 1}`,
      x: c[0],
      y: c[1],
      z: c[2],
      available: true,
      respawn: 0,
    })),
    randomMotes: true,
    randomShades: true,
    randomDrifters: map.drifters,
    windEnabled: map.wind,
    scenarioMotes: false,
    scenarioShades: false,
    scenarioDrifters: false,
    windActive: false,
    windDirDeg: 0,
    // Trạng thái input trước đó để phát hiện cạnh lên (contract mục C).
    last: { move: [0, 0], yaw: 0, jump: false, interact: false, pulse: false, dash: false, pause: false },
    nextMote: 1,
    nextShade: 1,
    nextDrifter: 1,
  };
  applyScenario(w, scenario ?? {});
  // Sinh ban đầu chỉ khi random bật và scenario không thay thế danh sách tương ứng.
  if (w.randomMotes && !w.scenarioMotes) placeInitialMotes(w);
  return w;
}

// Đèn đã thắp tạo vùng an toàn bán kính 6 m (Ticket-02 Phần 1).
function litSafeAt(w, x, z) {
  for (const l of w.lanterns) {
    if (l.lit && distXZ(x, z, l.x, l.z) < T.safe_radius) return true;
  }
  return false;
}

// Bóng Mực chỉ đứng được trên đảo và ngoài vùng an toàn.
function shadeCanStand(w, x, z, y) {
  return groundAt(w, x, z, y) > -Infinity && !litSafeAt(w, x, z);
}

function spawnRandomMote(w) {
  // Sinh 1 đom đóm ở một điểm trống của bản đồ (bỏ lượt nếu hết điểm trống).
  const free = w.map.motePoints.filter(
    (pt) => !w.motes.some((m) => distXZ(m.x, m.z, pt.x, pt.z) < 0.01)
  );
  if (free.length === 0) return false;
  const pt = free[Math.floor(w.rng() * free.length)];
  w.motes.push(makeMote(`M${w.nextMote++}`, pt.x, pt.y, pt.z, "random", null, 0));
  return true;
}

function spawnScheduledShade(w, events) {
  // Sinh trên điểm chuẩn cách người chơi ≥ 15 m; hết điểm hợp lệ thì bỏ lượt.
  if (w.shades.length >= w.map.shadeMax) return;
  const valid = w.map.shadePoints.filter(
    (pt) => distXZ(pt.x, pt.z, w.player.x, w.player.z) >= 15
  );
  if (valid.length === 0) return;
  const pt = valid[Math.floor(w.rng() * valid.length)];
  const s = makeShade(`S${w.nextShade++}`, [pt.x, pt.y, pt.z], "spawning");
  w.shades.push(s);
  if (events) events.push({ name: "shade_spawned", data: { id: s.id } });
}

function spawnScheduledDrifter(w) {
  const alive = w.drifters.filter((d) => d.state !== "removed").length;
  if (alive >= LAWS.driftMax) return;
  // Sinh trên điểm sương ngẫu nhiên = một điểm sinh đom đóm của bản đồ (A2-13).
  const pts = w.map.motePoints;
  const pt = pts[Math.floor(w.rng() * pts.length)];
  w.drifters.push(makeDrifter(`D${w.nextDrifter++}`, pt.x, pt.y + LAWS.driftYOffset, pt.z));
}

// Rơi đom đóm ra vành 1.5–2.5 m quanh chân Mây (A2-7); nhặt lại được từ tick sau.
function dropMotes(w, count, tick) {
  const dropped = [];
  for (let i = 0; i < count; i++) {
    const a = w.rng() * Math.PI * 2;
    const r = 1.5 + w.rng();
    let x = w.player.x + r * Math.cos(a);
    let z = w.player.z + r * Math.sin(a);
    let y = groundAt(w, x, z, w.player.y);
    if (y === -Infinity) {
      // ngoài đảo: kẹp về chân Mây (A2-7)
      x = w.player.x;
      z = w.player.z;
      y = w.player.y;
    }
    const m = makeMote(`M${w.nextMote++}`, x, y, z, "dropped", LAWS.hitDropTtlTicks, tick + 1);
    w.motes.push(m);
    dropped.push(m);
  }
  return dropped;
}

// Một bước mô phỏng: input tick k → trạng thái k+1; trả về các sự kiện của bước (tick = k+1).
export function step(w, input = {}) {
  const events = [];
  if (w.state !== "playing") return events;
  w.tick += 1;
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
    dash: input.dash !== undefined ? !!input.dash : prev.dash,
    pause: input.pause !== undefined ? !!input.pause : prev.pause,
  };
  w.last = cur;
  const p = w.player;

  // ── Bước 1. Đọc input — xử lý pause trước ─────────────────────────────
  if (cur.pause && !prev.pause) {
    w.paused = !w.paused;
    if (w.paused) {
      // vừa tạm dừng: dừng bước ở đây (tick vẫn tăng, sim_tick đứng yên)
      events.push({ name: "paused", data: {} });
      return events;
    }
    events.push({ name: "resumed", data: {} });
  }
  if (w.paused) return events; // đang tạm dừng: đứng yên toàn bộ mô phỏng
  w.simTick += 1;

  // ── Bước 2. Giảm các bộ đếm ───────────────────────────────────────────
  if (p.invuln > 0) p.invuln -= 1;
  if (p.dashCd > 0) p.dashCd -= 1;
  if (p.pulseCd > 0) p.pulseCd -= 1;
  if (p.charmTicks > 0) p.charmTicks -= 1;
  if (p.waiting) {
    p.respawnWait -= 1;
    if (p.respawnWait <= 0) {
      // hồi sinh ở điểm xuất phát, vận tốc 0, bất tử 90 tick
      p.waiting = false;
      const sp = w.map.spawn;
      p.x = sp[0];
      p.y = sp[1];
      p.z = sp[2];
      p.vx = 0;
      p.vy = 0;
      p.vz = 0;
      p.grounded = true;
      p.launch = false;
      p.dashTicks = 0;
      p.invuln = ticksOf(T.invuln_s);
    }
  }
  for (const s of w.shades) {
    if (s.state === "stunned") {
      s.stunTicks -= 1;
      if (s.stunTicks <= 0) toWanderOrChase(w, s);
    }
  }
  for (let i = w.motes.length - 1; i >= 0; i--) {
    const m = w.motes[i];
    if (m.ttl !== null) {
      m.ttl -= 1;
      if (m.ttl <= 0) w.motes.splice(i, 1);
    }
  }
  for (const c of w.charms) {
    if (!c.available) {
      c.respawn -= 1;
      if (c.respawn <= 0) {
        c.respawn = 0;
        c.available = true;
      }
    }
  }
  for (let i = w.drifters.length - 1; i >= 0; i--) {
    const d = w.drifters[i];
    if (d.state === "removed") {
      d.removeTicks -= 1;
      if (d.removeTicks <= 0) w.drifters.splice(i, 1);
    }
  }
  // Gió mạnh Đêm 3 (A2-9): mỗi 30 s (từ tick 1800) có 1 cơn gió 5 s (300 tick), không thổi ngay đầu Đêm.
  if (w.windEnabled) {
    const m = w.simTick % LAWS.windCycleTicks;
    if (w.simTick >= LAWS.windCycleTicks && m === 0) w.windDirDeg = w.rng() * 360;
    w.windActive = w.simTick >= LAWS.windCycleTicks && m < LAWS.windActiveTicks;
  } else {
    w.windActive = false;
  }

  // ── Bước 3. Di chuyển Mây (nhảy, lướt, bục nhảy, gió) rồi kiểm tra rơi ─
  if (p.waiting) {
    p.vx = 0;
    p.vz = 0;
  } else {
    const charmActive = p.charmTicks > 0;
    // Lướt (dash): kích hoạt khi chuyển false → true (contract mục C)
    if (cur.dash && !prev.dash && p.dashTicks === 0 && (charmActive || p.dashCd === 0)) {
      // hướng đang di chuyển; đứng yên thì hướng đang quay mặt
      let mx = cur.move[0];
      let mz = cur.move[1];
      const len = Math.hypot(mx, mz);
      if (len > 1e-9) {
        mx /= len;
        mz /= len;
      } else {
        mx = 0;
        mz = 1;
      }
      const cos = Math.cos(cur.yaw);
      const sin = Math.sin(cur.yaw);
      p.dashDX = mx * cos + mz * sin;
      p.dashDZ = -mx * sin + mz * cos;
      p.dashTicks = LAWS.dashTicks;
      if (!charmActive) p.dashCd = ticksOf(T.dash_cooldown_s); // bùa: lướt không hồi chiêu
      p.vy = 0; // lướt trên không giữ nguyên độ cao
      events.push({ name: "dash", data: {} });
    }

    let dx = 0;
    let dz = 0;
    if (p.dashTicks > 0) {
      dx = p.dashDX * T.dash_speed * DT;
      dz = p.dashDZ * T.dash_speed * DT;
      p.dashTicks -= 1;
    } else if (!p.grounded && p.launch) {
      // vận tốc phóng của bục nhảy giữ nguyên tới khi chạm đất (phím không ghi đè)
      dx = p.launchVX * DT;
      dz = p.launchVZ * DT;
    } else {
      let mx = cur.move[0];
      let mz = cur.move[1];
      const len = Math.hypot(mx, mz);
      if (len > 1) {
        mx /= len;
        mz /= len;
      }
      const cos = Math.cos(cur.yaw);
      const sin = Math.sin(cur.yaw);
      const vx = mx * cos + mz * sin;
      const vz = -mx * sin + mz * cos;
      const sp = charmActive ? LAWS.charmSpeed : T.player_speed;
      dx = vx * sp * DT;
      dz = vz * sp * DT;
    }
    // Gió mạnh: cộng vận tốc 2 m/s theo hướng gió
    if (w.windActive) {
      dx += LAWS.windSpeed * Math.cos(rad(w.windDirDeg)) * DT;
      dz += LAWS.windSpeed * Math.sin(rad(w.windDirDeg)) * DT;
    }
    // Di chuyển ngang — không đi xuyên vách cao hơn p.y + 0.5 (A2-10), nhưng cho phép bước ra khoảng không (rơi/bay)
    const canMove = (x, z) => {
      const topG = groundAt(w, x, z, 100);
      return topG <= p.y + LAWS.groundStep + 1e-9;
    };
    if (canMove(p.x + dx, p.z + dz)) {
      p.x += dx;
      p.z += dz;
    } else if (dx !== 0 && canMove(p.x + dx, p.z)) {
      p.x += dx;
    } else if (dz !== 0 && canMove(p.x, p.z + dz)) {
      p.z += dz;
    }
    p.vx = dx / DT;
    p.vz = dz / DT;

    // Nhảy — chỉ khi chạm đất
    if (cur.jump && !prev.jump && p.grounded) {
      p.vy = LAWS.jumpVy;
      p.grounded = false;
    }

    // Địa hình: dậm đất / rơi / bay do phóng
    if (p.dashTicks > 0) {
      // đang lướt: giữ nguyên độ cao, không trọng lực
    } else if (p.grounded) {
      const g = groundAt(w, p.x, p.z, p.y);
      if (g === -Infinity || g < p.y - 0.55) {
        p.grounded = false; // bước ra khỏi mép → rơi
        p.launch = false;
      } else {
        p.y = g;
      }
    } else {
      p.vy -= LAWS.gravity * DT;
      p.y += p.vy * DT;
      const g = groundAt(w, p.x, p.z, p.y);
      if (g > -Infinity && p.vy <= 0 && p.y <= g) {
        p.y = g;
        p.vy = 0;
        p.grounded = true;
        p.launch = false;
      }
    }

    // Bục nhảy: chân chạm bục (đang đứng đất) → phóng lên
    if (p.grounded) {
      for (const pad of w.map.pads) {
        if (distXZ(p.x, p.z, pad.x, pad.z) <= 1 && Math.abs(p.y - pad.y) <= 0.5) {
          const tx = pad.tx - pad.x;
          const tz = pad.tz - pad.z;
          const l = Math.hypot(tx, tz);
          p.launchVX = (tx / l) * pad.hv;
          p.launchVZ = (tz / l) * pad.hv;
          p.vy = pad.vy;
          p.grounded = false;
          p.launch = true;
          break;
        }
      }
    }
    // Không xuyên tháp chuông (Đêm 3)
    resolveObstacles(w.night, p);
  }

  // Rơi khỏi đảo: Y < −10, đúng 1 lần, bỏ qua bất tử
  if (!p.waiting && p.y < LAWS.fallY) {
    p.flames -= 1;
    const lost = p.carried;
    p.carried = 0;
    p.waiting = true;
    p.respawnWait = LAWS.respawnWaitTicks;
    p.vx = 0;
    p.vy = 0;
    p.vz = 0;
    p.grounded = false;
    p.launch = false;
    p.dashTicks = 0;
    events.push({ name: "player_hit", data: { by: "fall", flames: p.flames, lost } });
  }

  // ── Bước 4. Nhặt đom đóm và bùa ───────────────────────────────────────
  if (!p.waiting) {
    for (let i = 0; i < w.motes.length && p.carried < T.carry_capacity; ) {
      const m = w.motes[i];
      if (
        w.simTick >= m.pickAt && // đom đóm rơi nhặt lại được từ tick sau
        distXZ(m.x, m.z, p.x, p.z) <= T.pickup_radius &&
        Math.abs(p.y - m.y) <= 1.5
      ) {
        w.motes.splice(i, 1);
        p.carried += 1;
        events.push({ name: "mote_picked", data: { carried: p.carried } });
      } else {
        i += 1;
      }
    }
    for (const c of w.charms) {
      if (
        c.available &&
        distXZ(c.x, c.z, p.x, p.z) <= T.pickup_radius &&
        Math.abs(p.y - c.y) <= 1.5
      ) {
        c.available = false;
        c.respawn = LAWS.charmRespawnTicks;
        p.charmTicks = LAWS.charmDurationTicks; // nhặt lại làm mới
        events.push({
          name: "charm_picked",
          data: { charm_id: c.id, charm_ticks: LAWS.charmDurationTicks },
        });
      }
    }
  }

  // ── Bước 5. Nạp đèn ────────────────────────────────────────────────────
  if (cur.interact && !prev.interact && !p.waiting && p.carried > 0) {
    let best = null;
    let bestD = Infinity;
    for (const l of w.lanterns) {
      if (l.lit) continue; // chỉ xét đèn chưa sáng
      const d = distXZ(l.x, l.z, p.x, p.z);
      if (d <= T.interact_radius && (best === null || d < bestD || (d === bestD && num(l.id) < num(best.id)))) {
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
        // +10 mỗi đom đóm NẠP (A2-8)
        w.score += T.score.per_mote * amount;
        if (best.deposited >= T.lantern_cost) {
          best.lit = true;
          events.push({ name: "lantern_lit", data: { lantern_id: best.id } });
          w.score += T.score.per_lantern;
        }
      }
    }
  }

  // ── Bước 6. Cập nhật vùng an toàn ─────────────────────────────────────
  // Bóng Mực ở ngoài bị chặn ở mép 6 m; bóng đang ở trong lúc đèn vừa thắp
  // bị đẩy ra mép (ngay trong tick — đạt yêu cầu "tối đa 30 tick") và vì đã
  // bị đẩy ra khỏi bán kính chạm nên không gây sát thương trong lúc đó.
  for (const s of w.shades) {
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
      let dxs = s.x - bestL.x;
      let dzs = s.z - bestL.z;
      const d = Math.hypot(dxs, dzs);
      if (d === 0) {
        dxs = 1;
        dzs = 0;
      } else {
        dxs /= d;
        dzs /= d;
      }
      s.x = bestL.x + dxs * T.safe_radius;
      s.z = bestL.z + dzs * T.safe_radius;
    }
  }

  // ── Bước 7. Tỏa Sáng ──────────────────────────────────────────────────
  if (cur.pulse && !prev.pulse && !p.waiting && p.carried >= T.pulse_cost && p.pulseCd <= 0) {
    p.carried -= T.pulse_cost;
    p.pulseCd = ticksOf(T.pulse_cooldown_s);
    const cy = p.y + LAWS.pulseCenterY; // tâm = chân Mây + 0.8 m
    const ids = [];
    for (const s of w.shades) {
      // khoảng cách 3D tới tâm Bóng Mực (A2-5)
      const d3 = Math.hypot(s.x - p.x, s.y - cy, s.z - p.z);
      if (d3 <= T.pulse_radius) {
        s.state = "stunned";
        s.stunTicks = ticksOf(T.pulse_stun_s); // pulse lại làm mới choáng + đẩy lùi
        const d = distXZ(s.x, s.z, p.x, p.z);
        if (d < 1e-9) {
          s.pushDX = 1; // trùng vị trí: đẩy theo +X
          s.pushDZ = 0;
        } else {
          s.pushDX = (s.x - p.x) / d;
          s.pushDZ = (s.z - p.z) / d;
        }
        s.pushTicks = LAWS.pulsePushTicks;
        ids.push(s.id);
      }
    }
    // Tỏa Sáng trúng Gió Lạc
    for (const d of w.drifters) {
      const d3 = Math.hypot(d.x - p.x, d.y - cy, d.z - p.z);
      if (d3 > T.pulse_radius) continue;
      if (d.state === "chase") {
        d.state = "flee"; // chuyển flee không cướp
        d.fleeTicks = LAWS.driftFleeTicks;
      } else if (d.state === "flee" && d.stolen > 0) {
        // thả lại toàn bộ đom đóm đã cướp tại chỗ (thành đom đóm rơi)
        const gy = groundAt(w, d.x, d.z, d.y);
        const my = gy === -Infinity ? d.y - LAWS.driftYOffset : gy;
        for (let i = 0; i < d.stolen; i++) {
          w.motes.push(makeMote(`M${w.nextMote++}`, d.x, my, d.z, "dropped", LAWS.hitDropTtlTicks, w.simTick + 1));
        }
        events.push({ name: "drifter_drop", data: { drifter_id: d.id, amount: d.stolen } });
        d.stolen = 0;
        d.state = "removed";
        d.removeTicks = LAWS.driftRemovedTicks;
      }
    }
    ids.sort((a, b) => num(a) - num(b));
    events.push({ name: "pulse", data: { stunned_ids: ids } });
    // +5 mỗi Bóng Mực trúng, mỗi con mỗi lần, kể cả con đang choáng
    w.score += T.score.per_stun * ids.length;
  }

  // ── Bước 8. Di chuyển Bóng Mực và Gió Lạc ─────────────────────────────
  for (const s of w.shades) {
    if (s.state === "spawning") {
      s.stateTicks -= 1;
      if (s.stateTicks <= 0) toWanderOrChase(w, s);
    } else if (s.state === "wander") {
      if (w.simTick % LAWS.shadeWanderReroll === 0) {
        const a = w.rng() * Math.PI * 2;
        s.wdx = Math.cos(a);
        s.wdz = Math.sin(a);
      }
      if (distXZ(s.x, s.z, p.x, p.z) <= LAWS.shadeDetect) {
        s.state = "chase";
      } else {
        const nx = s.x + s.wdx * LAWS.shadeWanderSpeed * DT;
        const nz = s.z + s.wdz * LAWS.shadeWanderSpeed * DT;
        if (shadeCanStand(w, nx, nz, s.y)) {
          s.x = nx;
          s.z = nz;
        } else {
          s.wdx = -s.wdx; // vướng đảo/vùng an toàn: đảo hướng
          s.wdz = -s.wdz;
        }
      }
    } else if (s.state === "chase") {
      const dxs = p.x - s.x;
      const dzs = p.z - s.z;
      const d = Math.hypot(dxs, dzs);
      if (d > LAWS.shadeLose) {
        toWanderOrChase(w, s); // bỏ đuổi > 18 m
      } else if (d > 0) {
        const nx = s.x + (dxs / d) * w.shadeSpeed * DT;
        const nz = s.z + (dzs / d) * w.shadeSpeed * DT;
        if (shadeCanStand(w, nx, nz, s.y)) {
          s.x = nx;
          s.z = nz;
        }
      }
    } else if (s.state === "recoil") {
      // A2-6: lùi đều 2/60 m/tick ra xa Mây, không gây hit trong lúc recoil
      s.recoilTicks -= 1;
      const dxs = s.x - p.x;
      const dzs = s.z - p.z;
      const d = Math.hypot(dxs, dzs);
      const ux = d < 1e-9 ? 1 : dxs / d;
      const uz = d < 1e-9 ? 0 : dzs / d;
      const nx = s.x + ux * LAWS.shadeRecoilStep;
      const nz = s.z + uz * LAWS.shadeRecoilStep;
      if (shadeCanStand(w, nx, nz, s.y)) {
        s.x = nx;
        s.z = nz;
      }
      if (s.recoilTicks <= 0) toWanderOrChase(w, s);
    } else if (s.state === "stunned") {
      // đẩy lùi tổng 4 m trong 15 tick đầu (dừng nếu gặp vật cản/vùng an toàn)
      if (s.pushTicks > 0) {
        const step = T.pulse_push_m / LAWS.pulsePushTicks;
        const nx = s.x + s.pushDX * step;
        const nz = s.z + s.pushDZ * step;
        if (shadeCanStand(w, nx, nz, s.y)) {
          s.x = nx;
          s.z = nz;
        }
        s.pushTicks -= 1;
      }
    }
    // Bóng Mực lơ lửng ở groundY + 1.0 (A2-5); không xuyên tháp chuông
    const g = groundAt(w, s.x, s.z, s.y);
    if (g > -Infinity) s.y = g + LAWS.shadeYOffset;
    resolveObstacles(w.night, s);
  }
  for (let di = w.drifters.length - 1; di >= 0; di--) {
    const d = w.drifters[di];
    if (d.state === "removed") continue;
    const pd = distXZ(d.x, d.z, p.x, p.z);
    if (d.state === "idle") {
      // lượn tròn chậm quanh điểm xuất phát (A2-11)
      d.angle += (LAWS.driftIdleSpeed / LAWS.driftPatrolRadius) * DT;
      d.x = d.cx + LAWS.driftPatrolRadius * Math.cos(d.angle);
      d.z = d.cz + LAWS.driftPatrolRadius * Math.sin(d.angle);
      if (p.carried >= LAWS.driftChaseCarry && pd <= LAWS.driftChaseDist) d.state = "chase";
    } else if (d.state === "chase") {
      if (p.carried < LAWS.driftChaseCarry || pd > LAWS.driftChaseDist) {
        d.state = "idle"; // điều kiện mất → về idle
        d.cx = d.x;
        d.cz = d.z;
        d.angle = 0;
      } else if (pd > 0) {
        d.x += ((p.x - d.x) / pd) * LAWS.driftSpeed * DT;
        d.z += ((p.z - d.z) / pd) * LAWS.driftSpeed * DT;
      }
    } else if (d.state === "flee") {
      // bay ra xa Mây 7 m/s trong 240 tick rồi biến mất cùng số đã cướp
      d.fleeTicks -= 1;
      if (pd > 0) {
        d.x += ((d.x - p.x) / pd) * LAWS.driftSpeed * DT;
        d.z += ((d.z - p.z) / pd) * LAWS.driftSpeed * DT;
      }
      if (d.fleeTicks <= 0) {
        w.drifters.splice(di, 1);
        continue;
      }
    }
    const g = groundAt(w, d.x, d.z, d.y);
    if (g > -Infinity) d.y = g + LAWS.driftYOffset;
    resolveObstacles(w.night, d);
  }

  // ── Bước 9. Chạm: Gió Lạc cướp trước, rồi Bóng Mực gây hit ───────────
  if (!p.waiting) {
    const sorted = (arr) => arr.slice().sort((a, b) => num(a.id) - num(b.id));
    // Gió Lạc: chạm XZ ≤ 1.2 m → cướp min(3, đang mang) (bất tử của Mây không ngăn)
    for (const d of sorted(w.drifters)) {
      if (
        (d.state === "idle" || d.state === "chase") &&
        distXZ(d.x, d.z, p.x, p.z) <= LAWS.driftStealRadius
      ) {
        const amount = Math.min(3, p.carried);
        p.carried -= amount;
        d.stolen += amount;
        d.state = "flee";
        d.fleeTicks = LAWS.driftFleeTicks;
        events.push({
          name: "drifter_steal",
          data: { drifter_id: d.id, amount, carried: p.carried },
        });
      }
    }
    // Bóng Mực: tối đa 1 lần mất Ngọn Lửa mỗi tick, xét theo id tăng dần
    if (p.invuln <= 0) {
      for (const s of sorted(w.shades)) {
        if (
          (s.state === "wander" || s.state === "chase") &&
          distXZ(s.x, s.z, p.x, p.z) <= T.shade_hit_radius &&
          Math.abs(p.y - s.y) <= 1.5
        ) {
          p.flames -= 1;
          const dropped = Math.floor(p.carried * T.hit_drop_ratio);
          p.carried -= dropped;
          dropMotes(w, dropped, w.simTick);
          p.invuln = ticksOf(T.invuln_s);
          s.state = "recoil"; // bóng gây hit lùi 2 m trong 60 tick
          s.recoilTicks = LAWS.shadeRecoilTicks;
          events.push({
            name: "player_hit",
            data: { by: "shade", flames: p.flames, dropped },
          });
          break;
        }
      }
    }
  }

  // ── Bước 10. Sinh đom đóm, Bóng Mực, Gió Lạc theo lịch ────────────────
  // (thực thể mới chỉ tương tác được từ tick sau vì các bước trên đã chạy)
  if (w.randomMotes && !w.scenarioMotes && w.motes.length < LAWS.moteCap && w.simTick % LAWS.moteSpawnEveryTicks === 0) {
    spawnRandomMote(w);
  }
  if (w.randomShades && !w.scenarioShades) {
    if (w.simTick === LAWS.shadeSpawnStartTick) {
      for (let i = 0; i < LAWS.shadeSpawnFirst; i++) spawnScheduledShade(w, events);
    } else if (
      w.simTick > LAWS.shadeSpawnStartTick &&
      (w.simTick - LAWS.shadeSpawnStartTick) % w.map.shadeIntervalTicks === 0
    ) {
      spawnScheduledShade(w, events);
    }
  }
  if (w.randomDrifters && !w.scenarioDrifters && w.simTick % LAWS.driftSpawnEveryTicks === 0) {
    spawnScheduledDrifter(w);
  }

  // ── Bước 11. Xét thắng/thua ───────────────────────────────────────────
  if (p.flames <= 0) {
    w.state = "lost";
    events.push({ name: "game_over", data: { result: "lost", reason: "no_flames" } });
  } else if (w.lanterns.every((l) => l.lit)) {
    w.state = "won";
    const tl = timeLeftS(w);
    w.score += T.score.per_second_left * Math.floor(tl) + T.score.per_flame_left * p.flames;
    events.push({ name: "game_over", data: { result: "won", reason: "all_lit" } });
  } else if (timeLeftS(w) <= 0) {
    w.state = "lost";
    events.push({ name: "game_over", data: { result: "lost", reason: "dawn" } });
  }

  return events;
}

// Snapshot dùng cho output JSONL (contract v1.1 mục E) — tọa độ làm tròn 3 chữ số.
export function snapshot(w) {
  const p = w.player;
  return {
    tick: w.tick,
    sim_tick: w.simTick,
    state: w.paused ? "paused" : w.state,
    night: w.night,
    time_left_s: r3(timeLeftS(w)),
    score: w.score,
    wind: { active: w.windActive, dir_deg: r3(w.windDirDeg) },
    player: {
      pos: [r3(p.x), r3(p.y), r3(p.z)],
      vel: [r3(p.vx), r3(p.vy), r3(p.vz)],
      grounded: p.grounded,
      invuln: p.invuln > 0,
      dash_cd_s: r3(p.dashCd / TICKS_PER_SECOND),
      pulse_cd_s: r3(p.pulseCd / TICKS_PER_SECOND),
      charm_s: r3(p.charmTicks / TICKS_PER_SECOND),
      flames: p.flames,
      carried: p.carried,
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
    motes: w.motes.map((m) => ({
      id: m.id,
      pos: [r3(m.x), r3(m.y), r3(m.z)],
      kind: m.kind,
      ttl_s: m.ttl === null ? null : r3(m.ttl / TICKS_PER_SECOND),
    })),
    drifters: w.drifters.map((d) => ({
      id: d.id,
      pos: [r3(d.x), r3(d.y), r3(d.z)],
      state: d.state,
      stolen: d.stolen,
    })),
    charms: w.charms.map((c) => ({
      id: c.id,
      available: c.available,
      respawn_s: r3(c.respawn / TICKS_PER_SECOND),
    })),
  };
}
