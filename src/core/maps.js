// Bản đồ chuẩn 3 Đêm — Ticket-02 Phần 2.
// Góc α đo từ trục +X, ngược chiều kim đồng hồ nhìn từ trên xuống;
// quy đổi tọa độ (A2-1): x = r·cos(α), z = +r·sin(α).
// Thuần: không three, không DOM, không Date.now/Math.random.
const D2R = Math.PI / 180;
const EPS = 1e-9;

// Danh sách điểm: tâm (cx, cz), bán kính r, các góc (độ), độ cao y.
const pts = (cx, cz, r, angles, y = 0) =>
  angles.map((a) => ({ x: cx + r * Math.cos(a * D2R), y, z: cz + r * Math.sin(a * D2R) }));
const seq = (from, to, step) => {
  const out = [];
  for (let a = from; a <= to + EPS; a += step) out.push(Math.round(a * 10) / 10);
  return out;
};

export const MAPS = {
  1: {
    name: "Đảo Bến",
    duration_s: 240,
    spawn: [0, 0, 0],
    islands: [{ cx: 0, cz: 0, r: 40 }],
    lanterns: [
      { id: "L1", x: 0, y: 0, z: 25 },
      { id: "L2", x: 23.8, y: 0, z: 7.7 },
      { id: "L3", x: 14.7, y: 0, z: -20.2 },
      { id: "L4", x: -14.7, y: 0, z: -20.2 },
      { id: "L5", x: -23.8, y: 0, z: 7.7 },
    ],
    // 8 điểm bán kính 12 m (mỗi 45°) + 16 điểm bán kính 33 m (mỗi 22.5°)
    motePoints: [...pts(0, 0, 12, seq(0, 315, 45)), ...pts(0, 0, 33, seq(0, 337.5, 22.5))],
    // 12 điểm bán kính 37 m (15°, 45°, …)
    shadePoints: pts(0, 0, 37, seq(15, 345, 30)),
    shadeIntervalTicks: 480,
    shadeMax: 6,
    pads: [],
    charms: [],
    ramps: [],
    towers: [],
    drifters: false,
    wind: false,
  },
  2: {
    name: "Đảo Cau",
    duration_s: 270,
    spawn: [0, 0, 0],
    islands: [
      { cx: 0, cz: 0, r: 28 },
      { cx: 70, cz: 0, r: 28 },
    ],
    bridge: { x0: 26, x1: 44, zHalf: 2 },
    lanterns: [
      { id: "L1", x: 0, y: 0, z: 20 },
      { id: "L2", x: 17, y: 0, z: -10 },
      { id: "L3", x: -17, y: 0, z: -10 },
      { id: "L4", x: 70, y: 0, z: 20 },
      { id: "L5", x: 87, y: 0, z: -10 },
      { id: "L6", x: 53, y: 0, z: -10 },
    ],
    // Mỗi đảo: 4 điểm bán kính 10 m (0°, 90°, 180°, 270°) + 8 điểm bán kính 22 m (mỗi 45°)
    motePoints: [
      ...pts(0, 0, 10, [0, 90, 180, 270]),
      ...pts(0, 0, 22, seq(0, 315, 45)),
      ...pts(70, 0, 10, [0, 90, 180, 270]),
      ...pts(70, 0, 22, seq(0, 315, 45)),
    ],
    // 8 điểm bán kính 26 m mỗi đảo (22.5°, 67.5°, …)
    shadePoints: [...pts(0, 0, 26, seq(22.5, 337.5, 45)), ...pts(70, 0, 26, seq(22.5, 337.5, 45))],
    shadeIntervalTicks: 420,
    shadeMax: 8,
    // Bục nhảy: phóng vy, vận tốc ngang hv về tâm đảo kia
    pads: [
      { x: 20, y: 0, z: 18, vy: 14, hv: 24, tx: 70, tz: 0 },
      { x: 50, y: 0, z: -18, vy: 14, hv: 24, tx: 0, tz: 0 },
    ],
    charms: [[35, 0, 0]],
    ramps: [],
    towers: [],
    drifters: true,
    wind: false,
  },
  3: {
    name: "Đảo Chuông",
    duration_s: 300,
    spawn: [0, 0, -20], // tầng 0 thoáng (tâm (0,0,0) nằm dưới khối trụ tầng 2 Y=6)
    islands: [{ cx: 0, cz: 0, r: 45 }],
    lanterns: [
      { id: "L1", x: 0, y: 6, z: 6 },
      { id: "L2", x: 18, y: 3, z: 10 },
      { id: "L3", x: -18, y: 3, z: 10 },
      { id: "L4", x: 35, y: 0, z: -10 },
      { id: "L5", x: -35, y: 0, z: -10 },
      { id: "L6", x: 20, y: 0, z: -35 },
      { id: "L7", x: -20, y: 0, z: -35 },
    ],
    // Tầng 0: 18 điểm r34 (mỗi 20°); Tầng 1: 8 điểm r18 (20°..160°); Tầng 2: 4 điểm r5
    motePoints: [
      ...pts(0, 0, 34, seq(0, 340, 20), 0),
      ...pts(0, 0, 18, seq(20, 160, 20), 3),
      ...pts(0, 0, 5, [45, 135, 225, 315], 6),
    ],
    // 16 điểm bán kính 43 m (mỗi 22.5°)
    shadePoints: pts(0, 0, 43, seq(0, 337.5, 22.5)),
    shadeIntervalTicks: 360,
    shadeMax: 10,
    // Bục nhảy trên tầng 1: phóng lên tầng 2 (vận tốc ngang 8 m/s hướng −Z)
    pads: [{ x: 0, y: 3, z: 13, vy: 12, hv: 8, tx: 0, tz: -1000 }],
    charms: [
      [30, 0, 25],
      [-30, 0, 25],
    ],
    ramps: [30, 150], // 2 dốc dọc bán kính ở góc 30° và 150°
    towers: [{ x: 0, z: 0, r: 2, baseY: 6, topY: 14 }], // tháp chuông cao 8 m trên tầng 2
    drifters: true,
    wind: true,
  },
};

// Mặt đất hợp lệ cao nhất ≤ currentY + 0.5 (A2-10); ngoài đảo trả về -Infinity (rơi).
export function getGroundY(night, x, z, currentY) {
  if (night === 1) {
    return Math.hypot(x, z) <= 40 + EPS ? 0 : -Infinity;
  }
  if (night === 2) {
    const m = MAPS[2];
    const onIsland = m.islands.some((i) => Math.hypot(x - i.cx, z - i.cz) <= i.r + EPS);
    const onBridge =
      x >= m.bridge.x0 - EPS && x <= m.bridge.x1 + EPS && Math.abs(z) <= m.bridge.zHalf + EPS;
    return onIsland || onBridge ? 0 : -Infinity;
  }
  // Đêm 3 — 3 tầng + 2 dốc
  const r = Math.hypot(x, z);
  const cands = [];
  for (const aDeg of MAPS[3].ramps) {
    const c = Math.cos(aDeg * D2R);
    const s = Math.sin(aDeg * D2R);
    const rho = x * c + z * s; // tọa độ dọc bán kính
    const perp = -x * s + z * c; // vuông góc trục dốc
    if (rho >= 24 - EPS && rho <= 30 + EPS && Math.abs(perp) <= 1.5 + EPS) {
      cands.push((3 * (30 - rho)) / 6); // chân dốc r=30 (Y=0) → đỉnh r=24 (Y=3)
    }
  }
  if (r <= 45 + EPS) cands.push(0); // tầng 0
  if (r >= 12 - EPS && r <= 24 + EPS && z > 0) cands.push(3); // tầng 1 (vành khăn z > 0)
  if (r <= 8 + EPS) cands.push(6); // tầng 2 (đĩa tâm)
  const limit = currentY + 0.5 + EPS;
  let best = -Infinity;
  for (const g of cands) if (g <= limit && g > best) best = g;
  return best;
}

// Đẩy thực thể ra khỏi vật cản (tháp chuông Đêm 3 — trụ r=2 từ Y=6 đến Y=14).
export function resolveObstacles(night, pos) {
  if (night !== 3) return pos;
  if (pos.y > 5.4) {
    const r = Math.hypot(pos.x, pos.z);
    if (r < 2) {
      const ux = r < 1e-9 ? 1 : pos.x / r;
      const uz = r < 1e-9 ? 0 : pos.z / r;
      pos.x = ux * 2;
      pos.z = uz * 2;
    }
  }
  return pos;
}
