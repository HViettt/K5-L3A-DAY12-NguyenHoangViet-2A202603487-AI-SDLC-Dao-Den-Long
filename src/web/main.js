// Hiển thị 3D (Three.js) + HUD + Luồng 3 Đêm — chỉ đọc state từ src/core/, KHÔNG chứa luật chơi.
// Ticket-04: benchmark (?bench=1), bảng xếp hạng cục bộ, dễ tiếp cận (đổi phím, phụ đề,
// giảm chuyển động, chữ lớn), "Sáng tạo của tôi" (lời thì thầm khi thắp đèn, tắt khi bench).
import * as THREE from "three";
import { createWorld, step, snapshot } from "../core/world.js";
import { MAPS } from "../core/maps.js";
import { TUNING as T, DT, LAWS } from "../core/config.js";
import { createRng } from "../core/rng.js";
import { SoundEngine } from "./audio.js";

// Bảng màu chuẩn Ticket-02 Phần 3
const PAL = {
  sky: 0x0e1430,
  fog: 0x1b2350,
  grass: 0x2f5d50,
  sand: 0xc9b48a,
  wood: 0x6b4a2f,
  sea: 0x12384a,
  lanternLit: 0xffb347,
  lanternCore: 0xffe9b0,
  lanternOff: 0x5b5f6e,
  moteCore: 0xfff6c2,
  moteHalo: 0xffe58a,
  shadeBody: 0x120a1a,
  shadeRim: 0x7a3cff,
  shadeRimCB: 0x00b3ff, // Ticket-03 mục 6: chế độ mù màu
  shadeStun: 0x3a3450,
  mayRobe: 0xe8e2d0,
  mayScarf: 0xc8102e,
  gold: 0xf2c14e,
  drifter: 0x8fa3b8,
};

const NIGHT_INTRO = {
  1: {
    title: "Đêm 1 — Đảo Bến",
    quote: "Ông Đăng: “Sương đen đã phủ kín Đảo Bến rồi, Mây ơi. Cháu hãy gom đom đóm, thắp lại 5 ngọn Đèn Lồng Lớn trước khi bình minh đến.”",
    goal: "Giữ ít nhất 3/5 đèn sáng tới bình minh (châm dầu kẻo đèn cạn) · Thời gian: 04:00",
  },
  2: {
    title: "Đêm 2 — Đảo Cau",
    quote: "Ông Đăng: “Cầu tre nối hai bờ đảo rất hẹp, lại có Gió Lạc hay rình cướp ánh sáng. Dùng bục nhảy và Bùa Gió cho khéo nhé cháu!”",
    goal: "Giữ ít nhất 4/6 đèn sáng tới bình minh trên hai đảo · Thời gian: 04:30",
  },
  3: {
    title: "Đêm 3 — Đảo Chuông",
    quote: "Ông Đăng: “Đỉnh tháp chuông là ngọn đèn cuối cùng. Gió lớn trên đảo rất mạnh, nhưng ánh sáng của cháu sẽ dẫn lối cho cả biển mây.”",
    goal: "Giữ ít nhất 5/7 đèn sáng tới bình minh qua 3 tầng đảo · Thời gian: 05:00",
  },
};

// ═══ Ticket-04 mục 1: tham số chế độ Benchmark (?bench=1&seed=42&duration=30&t0=...) ═══
const qs = new URLSearchParams(location.search);
const BENCH = qs.get("bench") === "1";
const BENCH_SEED = Number.parseInt(qs.get("seed") ?? "42", 10);
const BENCH_DURATION = Number.parseFloat(qs.get("duration") ?? "30");
const BENCH_T0 = Number.parseInt(qs.get("t0") ?? String(Date.now()), 10);

const SETTINGS_KEY = "dao_den_long_settings_v1";
// Ticket-04 mục 4: mặc định 9 phím hành động (đổi được trong Cài đặt)
const DEFAULT_KEYS = {
  up: "KeyW",
  down: "KeyS",
  left: "KeyA",
  right: "KeyD",
  jump: "Space",
  dash: "ShiftLeft",
  interact: "KeyE",
  pulse: "KeyF",
  pause: "KeyP",
};
const ACTION_LABEL = {
  up: "Tiến",
  down: "Lùi",
  left: "Trái",
  right: "Phải",
  jump: "Nhảy",
  dash: "Lướt",
  interact: "Tương tác (nạp/châm dầu)",
  pulse: "Tỏa sáng",
  pause: "Tạm dừng",
};
const settings = (() => {
  const base = { volume: 0.6, sensitivity: 1.0, cbMode: false, reduceMotion: false, bigFont: false, keys: { ...DEFAULT_KEYS } };
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
    return { ...base, ...saved, keys: { ...DEFAULT_KEYS, ...(saved.keys ?? {}) } };
  } catch {
    return base;
  }
})();
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
}
// Ticket-03 mục 6: gắn/bỏ lớp CSS "cb" để đổi màu cảnh báo UI (#FF5A5F → #FFFFFF).
function applyColorblind() {
  document.body.classList.toggle("cb", !!settings.cbMode);
}
// Ticket-04 mục 4: áp dụng tuỳ chọn dễ tiếp cận (giảm chuyển động, chữ lớn)
function applyAccessibility() {
  applyColorblind();
  document.body.classList.toggle("reduce-motion", !!settings.reduceMotion);
  document.documentElement.classList.toggle("big-font", !!settings.bigFont);
}
applyAccessibility();

function keyName(code) {
  const map = {
    Space: "Space", ShiftLeft: "Shift", ShiftRight: "Shift phải",
    ControlLeft: "Ctrl", ControlRight: "Ctrl", AltLeft: "Alt", AltRight: "Alt",
    ArrowUp: "↑", ArrowDown: "↓", ArrowLeft: "←", ArrowRight: "→",
    Enter: "Enter", Escape: "Esc", Tab: "Tab", CapsLock: "Caps Lock",
  };
  if (map[code]) return map[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  return code;
}

const sfx = new SoundEngine(settings.volume);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PAL.sky);
scene.fog = new THREE.FogExp2(PAL.fog, 0.012);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 220);
const ambient = new THREE.AmbientLight(0xffe9b0, 0.15);
scene.add(ambient);
scene.add(new THREE.HemisphereLight(0x8fa3b8, PAL.sea, 0.35));
const dirLight = new THREE.DirectionalLight(0xfff6c2, 0.45);
dirLight.position.set(25, 45, 20);
scene.add(dirLight);

const seaMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(500, 500),
  new THREE.MeshBasicMaterial({ color: PAL.sea })
);
seaMesh.rotation.x = -Math.PI / 2;
seaMesh.position.y = -11;
scene.add(seaMesh);

const mapGroup = new THREE.Group();
scene.add(mapGroup);

// Mây: áo #E8E2D0, khăn #C8102E, nón lá + đèn nhỏ
const mayGroup = new THREE.Group();
const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.36, 0.95, 12), new THREE.MeshStandardMaterial({ color: PAL.mayRobe }));
robe.position.y = 0.48;
const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshStandardMaterial({ color: 0xf5d6ba }));
head.position.y = 1.08;
const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 8, 16), new THREE.MeshStandardMaterial({ color: PAL.mayScarf }));
scarf.rotation.x = Math.PI / 2;
scarf.position.y = 0.92;
const hat = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.32, 16), new THREE.MeshStandardMaterial({ color: PAL.sand }));
hat.position.y = 1.32;
const miniLantern = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshBasicMaterial({ color: PAL.lanternLit }));
miniLantern.position.set(0.45, 1.08, 0.12);
const mayLight = new THREE.PointLight(PAL.lanternLit, 1.6, 12);
mayLight.position.set(0, 1.3, 0);
mayGroup.add(robe, head, scarf, hat, miniLantern, mayLight);
scene.add(mayGroup);

const pulseRing = new THREE.Mesh(
  new THREE.RingGeometry(0.5, 0.85, 32),
  new THREE.MeshBasicMaterial({ color: PAL.moteHalo, side: THREE.DoubleSide, transparent: true, opacity: 0 })
);
pulseRing.rotation.x = -Math.PI / 2;
scene.add(pulseRing);
let pulseFxT = 0;

const leafGeo = new THREE.BufferGeometry();
const LEAF_COUNT = 80;
const leafPos = new Float32Array(LEAF_COUNT * 3);
for (let i = 0; i < LEAF_COUNT; i++) {
  leafPos[i * 3] = (Math.random() - 0.5) * 70;
  leafPos[i * 3 + 1] = 1 + Math.random() * 10;
  leafPos[i * 3 + 2] = (Math.random() - 0.5) * 70;
}
leafGeo.setAttribute("position", new THREE.BufferAttribute(leafPos, 3));
const leafPoints = new THREE.Points(leafGeo, new THREE.PointsMaterial({ color: PAL.gold, size: 0.35, transparent: true, opacity: 0.8 }));
leafPoints.visible = false;
scene.add(leafPoints);

let lanternMeshes = new Map();
let moteMeshes = new Map();
let shadeMeshes = new Map();
let drifterMeshes = new Map();
let charmMeshes = new Map();

function buildMapScene(night) {
  while (mapGroup.children.length) mapGroup.remove(mapGroup.children[0]);
  lanternMeshes.clear(); moteMeshes.clear(); shadeMeshes.clear(); drifterMeshes.clear(); charmMeshes.clear();

  const map = MAPS[night];
  const grassMat = new THREE.MeshStandardMaterial({ color: PAL.grass });
  const sandMat = new THREE.MeshStandardMaterial({ color: PAL.sand });
  const woodMat = new THREE.MeshStandardMaterial({ color: PAL.wood });

  for (const isl of map.islands) {
    const base = new THREE.Mesh(new THREE.CylinderGeometry(isl.r, isl.r * 0.94, 2, 48), grassMat);
    base.position.set(isl.cx, -1, isl.cz);
    mapGroup.add(base);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(isl.r - 0.6, 0.55, 8, 48), sandMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(isl.cx, 0.02, isl.cz);
    mapGroup.add(rim);
  }

  if (map.bridge) {
    const b = map.bridge;
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(b.x1 - b.x0, 0.35, b.zHalf * 2), woodMat);
    mesh.position.set((b.x0 + b.x1) / 2, -0.15, 0);
    mapGroup.add(mesh);
  }

  if (night === 3) {
    const shape = new THREE.Shape();
    shape.absarc(0, 0, 24, 0, Math.PI, false);
    shape.absarc(0, 0, 12, Math.PI, 0, true);
    const tier1Geo = new THREE.ExtrudeGeometry(shape, { depth: 3, bevelEnabled: false });
    tier1Geo.rotateX(Math.PI / 2);
    const tier1 = new THREE.Mesh(tier1Geo, grassMat);
    tier1.position.y = 3;
    mapGroup.add(tier1);

    const tier2 = new THREE.Mesh(new THREE.CylinderGeometry(8, 8.2, 6, 36), grassMat);
    tier2.position.set(0, 3, 0);
    mapGroup.add(tier2);

    for (const deg of map.ramps) {
      const a = (deg * Math.PI) / 180;
      const len = Math.hypot(6, 3);
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, 3), woodMat);
      ramp.position.set(27 * Math.cos(a), 1.5, 27 * Math.sin(a));
      ramp.rotation.y = -a;
      ramp.rotation.z = Math.atan2(-3, 6);
      mapGroup.add(ramp);
    }

    for (const tw of map.towers) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(tw.r, tw.r, tw.topY - tw.baseY, 20), woodMat);
      tower.position.set(tw.x, (tw.baseY + tw.topY) / 2, tw.z);
      mapGroup.add(tower);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(tw.r * 1.45, 2.2, 16), new THREE.MeshStandardMaterial({ color: PAL.mayScarf }));
      roof.position.set(tw.x, tw.topY + 1.1, tw.z);
      mapGroup.add(roof);
    }
  }

  for (const pad of map.pads) {
    const p = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1.15, 0.25, 20),
      new THREE.MeshStandardMaterial({ color: PAL.gold, emissive: PAL.lanternLit, emissiveIntensity: 0.45 })
    );
    p.position.set(pad.x, pad.y + 0.12, pad.z);
    mapGroup.add(p);
  }

  for (const l of map.lanterns) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.24, 3.2, 10), woodMat);
    pole.position.y = 1.6;
    const bulbMat = new THREE.MeshStandardMaterial({ color: PAL.lanternOff, emissive: 0x000000 });
    const bulb = new THREE.Mesh(new THREE.OctahedronGeometry(0.62, 1), bulbMat);
    bulb.position.y = 3.4;
    const light = new THREE.PointLight(PAL.lanternLit, 0, 18);
    light.position.y = 3.4;
    // Ticket-03 mục 1: thanh dầu trên đầu cột, co giãn theo fuel/100 (neo mép trái)
    const fuelGeo = new THREE.BoxGeometry(1.2, 0.14, 0.18);
    fuelGeo.translate(0.6, 0, 0);
    const fuelBar = new THREE.Mesh(fuelGeo, new THREE.MeshBasicMaterial({ color: PAL.lanternLit }));
    fuelBar.position.y = 4.25;
    fuelBar.visible = false;
    // Ticket-03 mục 6: viền/vết rách quanh bầu đèn tắt (chế độ mù màu)
    const tear = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.055, 6, 20), new THREE.MeshBasicMaterial({ color: 0xf5f1e6 }));
    tear.position.y = 3.4;
    tear.visible = false;
    g.add(pole, bulb, light, fuelBar, tear);
    g.position.set(l.x, l.y, l.z);
    mapGroup.add(g);
    lanternMeshes.set(l.id, { group: g, bulbMat, light, fuelBar, tear });
  }
}

const moteGeo = new THREE.SphereGeometry(0.24, 10, 8);
const moteMatRand = new THREE.MeshBasicMaterial({ color: PAL.moteCore });
const moteMatDrop = new THREE.MeshBasicMaterial({ color: PAL.moteHalo });

function syncEntities(snap, tSec) {
  let litCount = 0;
  const shadeRim = settings.cbMode ? PAL.shadeRimCB : PAL.shadeRim;
  for (const l of snap.lanterns) {
    if (l.lit) litCount++;
    const m = lanternMeshes.get(l.id);
    if (!m) continue;
    const fuel = typeof l.fuel === "number" ? l.fuel : 0;
    // Ticket-03 mục 1: fuel < 30 → đèn và thanh dầu nhấp nháy chậm 1 Hz (0.5 s bật / 0.5 s tắt)
    const lowFuel = l.lit && fuel < T.low_fuel_threshold;
    const blinkOff = lowFuel && Math.floor(tSec * 2) % 2 === 1;
    if (l.lit) {
      m.bulbMat.color.setHex(PAL.lanternCore);
      m.bulbMat.emissive.setHex(PAL.lanternLit);
      m.bulbMat.emissiveIntensity = blinkOff ? 0.3 : 1.2;
      m.light.intensity = blinkOff ? 0.6 : 2.6;
      m.fuelBar.visible = !blinkOff;
      m.fuelBar.scale.x = Math.max(0, Math.min(1, fuel / T.fuel_max));
    } else {
      m.bulbMat.color.setHex(PAL.lanternOff);
      m.bulbMat.emissive.setHex(l.deposited > 0 ? PAL.lanternLit : 0x000000);
      m.bulbMat.emissiveIntensity = (l.deposited / T.lantern_cost) * 0.5;
      m.light.intensity = 0;
      m.fuelBar.visible = false;
    }
    // Ticket-03 mục 6: đèn tắt xẹp 20% + viền/vết rách để phân biệt không cần màu
    const squash = settings.cbMode && !l.lit;
    m.group.scale.y = squash ? 0.8 : 1;
    m.tear.visible = squash;
  }
  ambient.intensity = 0.15 + 0.55 * (litCount / Math.max(1, snap.lanterns.length));

  const seenM = new Set();
  for (const m of snap.motes) {
    seenM.add(m.id);
    let mesh = moteMeshes.get(m.id);
    if (!mesh) {
      mesh = new THREE.Mesh(moteGeo, m.kind === "dropped" ? moteMatDrop : moteMatRand);
      mapGroup.add(mesh);
      moteMeshes.set(m.id, mesh);
    }
    mesh.position.set(m.pos[0], m.pos[1] + 0.75 + Math.sin(tSec * 4 + m.pos[0]) * 0.15, m.pos[2]);
  }
  for (const [id, mesh] of moteMeshes) {
    if (!seenM.has(id)) { mapGroup.remove(mesh); moteMeshes.delete(id); }
  }

  const seenS = new Set();
  for (const s of snap.shades) {
    seenS.add(s.id);
    let obj = shadeMeshes.get(s.id);
    if (!obj) {
      const mat = new THREE.MeshStandardMaterial({ color: PAL.shadeBody, emissive: PAL.shadeRim, emissiveIntensity: 0.7 });
      const mesh = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.5, 10), mat);
      mapGroup.add(mesh);
      obj = { mesh, mat };
      shadeMeshes.set(s.id, obj);
    }
    obj.mesh.position.set(s.pos[0], s.pos[1], s.pos[2]);
    if (s.state === "stunned") {
      obj.mat.color.setHex(PAL.shadeStun);
      obj.mat.emissive.setHex(PAL.shadeStun);
      obj.mat.emissiveIntensity = 0.35;
    } else {
      obj.mat.color.setHex(PAL.shadeBody);
      obj.mat.emissive.setHex(shadeRim); // mù màu: #7A3CFF → #00B3FF
      obj.mat.emissiveIntensity = s.state === "chase" || s.state === "drain" ? 1.0 : 0.45;
    }
  }
  for (const [id, obj] of shadeMeshes) {
    if (!seenS.has(id)) { mapGroup.remove(obj.mesh); shadeMeshes.delete(id); }
  }

  const seenD = new Set();
  for (const d of snap.drifters) {
    if (d.state === "removed") continue;
    seenD.add(d.id);
    let mesh = drifterMeshes.get(d.id);
    if (!mesh) {
      mesh = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.45, 0),
        new THREE.MeshStandardMaterial({ color: PAL.drifter, emissive: PAL.drifter, emissiveIntensity: 0.4, transparent: true, opacity: 0.85 })
      );
      mapGroup.add(mesh);
      drifterMeshes.set(d.id, mesh);
    }
    mesh.position.set(d.pos[0], d.pos[1] + Math.sin(tSec * 6) * 0.2, d.pos[2]);
    mesh.rotation.y = tSec * 3;
  }
  for (const [id, mesh] of drifterMeshes) {
    if (!seenD.has(id)) { mapGroup.remove(mesh); drifterMeshes.delete(id); }
  }

  const mapCharms = MAPS[snap.night].charms;
  snap.charms.forEach((c, idx) => {
    let mesh = charmMeshes.get(c.id);
    if (!mesh && mapCharms[idx]) {
      mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, 0.7, 0.08),
        new THREE.MeshStandardMaterial({ color: PAL.mayScarf, emissive: PAL.gold, emissiveIntensity: 0.35 })
      );
      mesh.position.set(mapCharms[idx][0], mapCharms[idx][1] + 0.9, mapCharms[idx][2]);
      mapGroup.add(mesh);
      charmMeshes.set(c.id, mesh);
    }
    if (mesh) {
      mesh.visible = c.available;
      mesh.rotation.y = tSec * 2.2;
    }
  });
}

const $ = (id) => document.getElementById(id);
const moteBarEl = $("mote-bar");
// Ticket-03 mục 4: sức chứa tăng tới capacity_max (20) — dựng đủ 20 ô, ẩn ô vượt capacity
for (let i = 0; i < T.capacity_max; i++) {
  const d = document.createElement("div");
  d.className = "mote-slot";
  moteBarEl.appendChild(d);
}
const moteSlots = [...moteBarEl.children];

let mode = "menu";
let currentNight = 1;
let totalScore = 0;
let nightsWonRun = 0; // số Đêm thắng trong hành trình hiện tại (để lưu bảng xếp hạng)
let currentSeed = 8; // seed của Đêm đang chơi (để lưu bảng xếp hạng)
let world = null;
let camYawDeg = 0;
let lastCountdownSec = 11;
let settingsReturnTo = "menu";

const keys = new Set();
const edgePress = { jump: false, interact: false, pulse: false, dash: false, pause: false };

function showOnly(screenId) {
  for (const id of ["screen-menu", "screen-leaderboard", "screen-intro", "screen-pause", "screen-settings", "screen-result"]) {
    $(id).classList.toggle("show", id === screenId);
  }
  $("hud").style.display = screenId === null || screenId === "screen-pause" ? "block" : "none";
}

function openIntro(night) {
  currentNight = night;
  mode = "intro";
  const info = NIGHT_INTRO[night];
  $("intro-title").textContent = info.title;
  $("intro-quote").textContent = info.quote;
  $("intro-goal").textContent = info.goal;
  showOnly("screen-intro");
}

function startNight(night) {
  sfx.unlock();
  currentNight = night;
  currentSeed = night * 101 + 7;
  world = createWorld({ seed: currentSeed, night });
  buildMapScene(night);
  camYawDeg = 0;
  lastCountdownSec = 11;
  knownShades.clear();
  mode = "playing";
  $("night-label").textContent = `Đêm ${night} — ${MAPS[night].name}`;
  showOnly(null);
}

function togglePause() {
  if (!world || (mode !== "playing" && mode !== "paused")) return;
  edgePress.pause = true;
}

$("btn-start").onclick = () => { totalScore = 0; nightsWonRun = 0; openIntro(1); };
document.querySelectorAll("[data-night]").forEach((b) => {
  b.onclick = () => { totalScore = 0; nightsWonRun = 0; openIntro(Number(b.dataset.night)); };
});
$("btn-intro-go").onclick = () => startNight(currentNight);
$("btn-resume").onclick = () => togglePause();
$("btn-retry-pause").onclick = () => startNight(currentNight);
$("btn-to-menu").onclick = () => { mode = "menu"; world = null; showOnly("screen-menu"); };
$("btn-retry-res").onclick = () => startNight(currentNight);
$("btn-res-menu").onclick = () => { mode = "menu"; world = null; showOnly("screen-menu"); };
$("btn-next").onclick = () => openIntro(currentNight + 1);

// ═══ Ticket-04 mục 3: Bảng xếp hạng cục bộ ═══
$("btn-leaderboard").onclick = async () => {
  mode = "menu";
  showOnly("screen-leaderboard");
  const body = $("lb-body");
  body.innerHTML = "";
  $("lb-msg").textContent = "Đang tải…";
  try {
    const res = await fetch("/api/leaderboard");
    const data = await res.json();
    const entries = (data.entries ?? []).slice(0, 10);
    if (entries.length === 0) {
      $("lb-msg").textContent = "Chưa có ai lên bảng — hãy là người đầu tiên!";
      return;
    }
    $("lb-msg").textContent = "";
    entries.forEach((e, i) => {
      const tr = document.createElement("tr");
      const at = String(e.achieved_at ?? "").replace("T", " ").slice(0, 16);
      const cells = [
        { v: String(i + 1) },
        { v: String(e.name) },
        { v: String(e.score), num: true },
        { v: String(e.nights_won), num: true },
        { v: at },
      ];
      for (const c of cells) {
        const td = document.createElement("td");
        if (c.num) td.className = "num";
        td.textContent = c.v;
        tr.appendChild(td);
      }
      body.appendChild(tr);
    });
  } catch {
    $("lb-msg").textContent = "Không tải được bảng xếp hạng (server chưa chạy?).";
  }
};
$("btn-lb-close").onclick = () => showOnly("screen-menu");

async function saveScoreToLeaderboard() {
  const name = $("lb-name").value.trim();
  const status = $("lb-status");
  // 3–12 ký tự chữ/số/_ (khớp NAME_RE phía server, hỗ trợ tiếng Việt có dấu)
  if (!/^[\p{L}0-9_]{3,12}$/u.test(name)) {
    status.textContent = "Tên phải dài 3–12 ký tự (chữ cái, số hoặc _, không khoảng trắng).";
    return;
  }
  $("btn-save-score").disabled = true;
  status.textContent = "Đang lưu…";
  try {
    const res = await fetch("/api/leaderboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, score: totalScore, nights_won: nightsWonRun, seed: currentSeed }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Lỗi lưu điểm");
    status.textContent = "✓ Đã lưu điểm vào bảng xếp hạng!";
  } catch (e) {
    status.textContent = `Lỗi: ${e.message}`;
    $("btn-save-score").disabled = false;
  }
}
$("btn-save-score").onclick = saveScoreToLeaderboard;

// ═══ Ticket-04 mục 5: "Sáng tạo của tôi" — lời thì thầm cổ tích khi thắp đèn (tắt khi bench) ═══
const WHISPERS = [
  "Ngọn đèn khẽ thở hơi ấm, và màn sương lùi lại một bước…",
  "Người ta bảo: đèn nào được thắp bằng lòng tốt sẽ cháy tới bình minh.",
  "Đom đóm xung quanh nghiêng mình, như vỗ tay cho ngọn lửa mới.",
  "Nơi có ánh đèn, sao trời ghé lại nghỉ chân một đêm.",
  "Ông Đăng nơi bến xa mỉm cười — lại có thêm một ngọn đèn được canh.",
];
let whisperIdx = 0;
let whisperTimer = null;
function showWhisper() {
  if (BENCH) return; // tắt trong chế độ benchmark
  const el = $("whisper");
  el.textContent = `✨ ${WHISPERS[whisperIdx++ % WHISPERS.length]}`;
  el.classList.add("show");
  clearTimeout(whisperTimer);
  whisperTimer = setTimeout(() => el.classList.remove("show"), 3000);
}

function openSettings(from) {
  settingsReturnTo = from;
  $("opt-vol").value = Math.round(settings.volume * 100);
  $("val-vol").textContent = `${Math.round(settings.volume * 100)}%`;
  $("opt-sens").value = settings.sensitivity;
  $("val-sens").textContent = `${settings.sensitivity.toFixed(1)}x`;
  $("opt-cb").checked = !!settings.cbMode;
  $("opt-motion").checked = !!settings.reduceMotion;
  $("opt-big").checked = !!settings.bigFont;
  renderKeybinds();
  $("keybind-error").textContent = "";
  showOnly("screen-settings");
}
$("btn-menu-settings").onclick = () => openSettings("menu");
$("btn-pause-settings").onclick = () => openSettings("pause");
$("opt-vol").oninput = (e) => {
  settings.volume = Number(e.target.value) / 100;
  $("val-vol").textContent = `${e.target.value}%`;
  sfx.setVolume(settings.volume);
};
$("opt-sens").oninput = (e) => {
  settings.sensitivity = Number(e.target.value);
  $("val-sens").textContent = `${settings.sensitivity.toFixed(1)}x`;
};
// Ticket-03 mục 6: "Bảng màu dễ phân biệt" — lưu localStorage, áp dụng ngay khi bật/tắt
$("opt-cb").onchange = (e) => {
  settings.cbMode = !!e.target.checked;
  applyAccessibility();
};
// Ticket-04 mục 4: giảm chuyển động + chữ lớn
$("opt-motion").onchange = (e) => {
  settings.reduceMotion = !!e.target.checked;
  applyAccessibility();
};
$("opt-big").onchange = (e) => {
  settings.bigFont = !!e.target.checked;
  applyAccessibility();
};
$("btn-settings-close").onclick = () => {
  saveSettings();
  showOnly(settingsReturnTo === "pause" ? "screen-pause" : "screen-menu");
};

// ═══ Ticket-04 mục 4: đổi phím 9 hành động, báo trùng phím, khôi phục mặc định ═══
let captureAction = null;
function renderKeybinds() {
  const wrap = $("keybinds");
  wrap.innerHTML = "";
  for (const act of Object.keys(DEFAULT_KEYS)) {
    const row = document.createElement("div");
    row.className = "keybind-row";
    const label = document.createElement("span");
    label.textContent = ACTION_LABEL[act];
    const btn = document.createElement("button");
    btn.className = "sec keybind-btn";
    btn.textContent = captureAction === act ? "Nhấn phím…" : keyName(settings.keys[act]);
    btn.onclick = () => {
      captureAction = act;
      $("keybind-error").textContent = "";
      renderKeybinds();
    };
    row.append(label, btn);
    wrap.appendChild(row);
  }
}
$("btn-keys-reset").onclick = () => {
  settings.keys = { ...DEFAULT_KEYS };
  captureAction = null;
  $("keybind-error").textContent = "";
  renderKeybinds();
  saveSettings();
};

addEventListener("keydown", (e) => {
  if (captureAction) {
    e.preventDefault();
    e.stopPropagation();
    if (e.code === "Escape") {
      // Esc để huỷ bắt phím
      captureAction = null;
      $("keybind-error").textContent = "";
      renderKeybinds();
      return;
    }
    const conflict = Object.entries(settings.keys).find(([act, code]) => code === e.code && act !== captureAction);
    if (conflict) {
      $("keybind-error").textContent = `Phím "${keyName(e.code)}" đã được dùng cho hành động "${ACTION_LABEL[conflict[0]]}" — chọn phím khác.`;
      return;
    }
    settings.keys[captureAction] = e.code;
    captureAction = null;
    $("keybind-error").textContent = "";
    renderKeybinds();
    saveSettings();
    return;
  }
  sfx.unlock();
  if (!keys.has(e.code)) {
    if (e.code === settings.keys.jump) edgePress.jump = true;
    if (e.code === settings.keys.interact) edgePress.interact = true;
    if (e.code === settings.keys.pulse) edgePress.pulse = true;
    if (e.code === settings.keys.dash) edgePress.dash = true;
    if (e.code === settings.keys.pause || e.code === "Escape") togglePause();
  }
  keys.add(e.code);
});
addEventListener("keyup", (e) => keys.delete(e.code));

let dragging = false;
renderer.domElement.addEventListener("mousedown", (e) => {
  sfx.unlock();
  if (e.button === 2 && mode === "playing") { edgePress.dash = true; return; }
  dragging = true;
});
addEventListener("mouseup", () => (dragging = false));
addEventListener("contextmenu", (e) => e.preventDefault());
addEventListener("mousemove", (e) => {
  if (mode !== "playing") return;
  if (dragging || document.pointerLockElement === renderer.domElement) {
    camYawDeg = (camYawDeg - e.movementX * 0.25 * settings.sensitivity) % 360;
  }
});
addEventListener("resize", () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// ═══ Ticket-04 mục 4: phụ đề / chỉ báo hình ảnh ═══
const knownShades = new Set(); // id Bóng Mực đã biết — id mới = "vừa xuất hiện"
let shadeAlertUntil = 0;
let shadeAlertPos = null;

const projVec = new THREE.Vector3();
// Chiếu điểm 3D lên mép màn hình, trả về vị trí mũi tên (px) hoặc null nếu đang trên màn hình
function edgeArrowPos(x, y, z) {
  projVec.set(x, y, z).project(camera);
  const inFront = projVec.z < 1;
  const onScreen = inFront && Math.abs(projVec.x) <= 0.95 && Math.abs(projVec.y) <= 0.95;
  if (onScreen) return null;
  const nx = inFront ? projVec.x : -projVec.x;
  const ny = inFront ? projVec.y : -projVec.y;
  const ang = Math.atan2(-ny, nx);
  const pad = 42, cx = innerWidth / 2, cy = innerHeight / 2;
  const scale = Math.min((cx - pad) / Math.max(0.001, Math.abs(Math.cos(ang))), (cy - pad) / Math.max(0.001, Math.abs(Math.sin(ang))));
  return { left: cx + Math.cos(ang) * scale, top: cy + Math.sin(ang) * scale, ang };
}
function placeArrow(el, target) {
  const p = target !== null ? edgeArrowPos(target[0], target[1], target[2]) : null;
  if (p && mode === "playing") {
    el.style.display = "flex";
    el.style.left = `${p.left}px`;
    el.style.top = `${p.top}px`;
    el.style.transform = `rotate(${p.ang}rad)`;
  } else {
    el.style.display = "none";
  }
}

function updateSubtitles(snap, sec, windWarn) {
  const nowMs = performance.now();
  // Bóng Mực vừa xuất hiện (id mới trong snapshot)
  for (const s of snap.shades) {
    if (!knownShades.has(s.id)) {
      knownShades.add(s.id);
      shadeAlertUntil = nowMs + 3000;
      shadeAlertPos = [s.pos[0], s.pos[1], s.pos[2]];
    }
  }
  const lowFuel = snap.lanterns.some((l) => l.lit && l.fuel < T.low_fuel_threshold);
  let sub = "";
  let arrowTarget = null;
  if (performance.now() < shadeAlertUntil) {
    sub = "⚠ Bóng Mực vừa xuất hiện!";
    arrowTarget = shadeAlertPos;
  } else if (lowFuel) {
    sub = "⚠ Có đèn đang cạn dầu (fuel < 30) — nhớ châm dầu!";
  } else if (snap.wind.active) {
    sub = "🌬 Gió mạnh đang thổi!";
  } else if (windWarn) {
    sub = "🌬 Gió sắp thổi…";
  } else if (sec <= 10 && sec > 0) {
    sub = "⏱ 10 giây cuối cùng!";
  }
  const subEl = $("subtitle");
  subEl.textContent = sub;
  subEl.style.display = sub ? "block" : "none";
  placeArrow($("shade-arrow"), arrowTarget);
}

function updateHud(snap) {
  const fl = $("flames");
  fl.innerHTML = "";
  for (let i = 0; i < T.flames; i++) {
    const sp = document.createElement("span");
    sp.className = "flame" + (i < snap.player.flames ? "" : " off");
    sp.textContent = "🔥";
    fl.appendChild(sp);
  }
  const sec = Math.max(0, Math.ceil(snap.time_left_s));
  const mm = String(Math.floor(sec / 60)).padStart(2, "0");
  const ss = String(sec % 60).padStart(2, "0");
  const timerEl = $("timer");
  timerEl.textContent = (settings.cbMode ? "⚠ " : "") + `${mm}:${ss}`; // mù màu: thêm biểu tượng ⚠
  timerEl.classList.toggle("urgent", sec <= 30);
  if (sec <= 10 && sec > 0 && sec < lastCountdownSec) {
    lastCountdownSec = sec;
    sfx.countdown();
  }
  const lit = snap.lanterns.filter((l) => l.lit).length;
  $("lanterns-hud").textContent = `🏮 ${lit} / ${snap.lanterns.length}`;
  $("score-hud").textContent = `Điểm: ${snap.score}`;

  const dashBox = $("skill-dash");
  const dashReady = snap.player.dash_cd_s <= 0 || snap.player.charm_s > 0;
  dashBox.classList.toggle("ready", dashReady);
  dashBox.querySelector(".cd").textContent = dashReady ? "Sẵn" : `${snap.player.dash_cd_s.toFixed(1)}s`;

  const pulseBox = $("skill-pulse");
  const pulseReady = snap.player.pulse_cd_s <= 0 && snap.player.carried >= T.pulse_cost;
  pulseBox.classList.toggle("ready", pulseReady);
  pulseBox.querySelector(".cd").textContent =
    snap.player.pulse_cd_s > 0 ? `${snap.player.pulse_cd_s.toFixed(1)}s` : (snap.player.carried >= T.pulse_cost ? "Sẵn" : "Thiếu");

  const bCharm = $("badge-charm");
  bCharm.style.display = snap.player.charm_s > 0 ? "inline-block" : "none";
  if (snap.player.charm_s > 0) bCharm.textContent = `Bùa Gió: ${snap.player.charm_s.toFixed(1)}s`;

  const windWarn = snap.night === 3 && !snap.wind.active && (world.simTick % LAWS.windCycleTicks) >= (LAWS.windCycleTicks - LAWS.windWarnTicks);
  const bWind = $("badge-wind");
  bWind.style.display = (snap.wind.active || windWarn) ? "inline-block" : "none";
  bWind.textContent =
    (settings.cbMode ? "⚠ " : "") +
    (snap.wind.active ? `Gió mạnh (${Math.round(snap.wind.dir_deg)}°)` : "Sắp có gió mạnh…");
  leafPoints.visible = snap.wind.active || windWarn;

  // Ticket-03 mục 4: HUD "đang mang / capacity" (sức chứa tăng dần tới 20)
  const cap = snap.player.capacity ?? T.carry_capacity;
  for (let i = 0; i < moteSlots.length; i++) {
    moteSlots[i].style.display = i < cap ? "" : "none";
    moteSlots[i].classList.toggle("filled", i < snap.player.carried);
  }
  $("carry-label").textContent = `Đang mang: ${snap.player.carried} / ${cap}`;

  // Nhắc E đúng trạng thái đèn: nạp mới / thắp lại (ever_lit) / châm dầu (đang sáng)
  let nearest = null, bestD = Infinity;
  const px = snap.player.pos[0], pz = snap.player.pos[2];
  for (const l of snap.lanterns) {
    const receivable = !l.lit || l.fuel < T.fuel_max; // đèn nhận được: chưa sáng, hoặc sáng nhưng chưa đầy dầu
    if (!receivable) continue;
    const d = Math.hypot(l.pos[0] - px, l.pos[2] - pz);
    if (d < bestD) { bestD = d; nearest = l; }
  }
  const promptE = $("prompt-e");
  if (nearest && bestD <= T.interact_radius) {
    promptE.style.display = "block";
    if (nearest.lit) {
      promptE.textContent = `E — Châm dầu (${Math.round(nearest.fuel)}%)`;
    } else if (nearest.ever_lit) {
      promptE.textContent = `E — Thắp lại (${nearest.deposited}/${T.relight_cost})`;
    } else {
      promptE.textContent = `E — Nạp ánh sáng (${nearest.deposited}/${T.lantern_cost})`;
    }
  } else {
    promptE.style.display = "none";
  }

  placeArrow($("offscreen-arrow"), nearest ? [nearest.pos[0], nearest.pos[1] + 3.4, nearest.pos[2]] : null);
  updateSubtitles(snap, sec, windWarn);
}

function handleEvents(events, snap) {
  for (const ev of events) {
    if (ev.name === "mote_picked") sfx.pickup();
    else if (ev.name === "deposit") sfx.deposit();
    else if (ev.name === "lantern_lit") { sfx.lanternLit(); showWhisper(); }
    else if (ev.name === "pulse") { sfx.pulse(); pulseFxT = 0.35; }
    else if (ev.name === "player_hit") sfx.hit();
    else if (ev.name === "dash") sfx.dash();
    else if (ev.name === "shade_spawned") sfx.shadeSpawn();
    else if (ev.name === "charm_picked") sfx.charm();
    else if (ev.name === "paused") { mode = "paused"; showOnly("screen-pause"); }
    else if (ev.name === "resumed") { mode = "playing"; showOnly(null); }
    else if (ev.name === "game_over") {
      mode = "result";
      const won = ev.data.result === "won";
      if (won) { sfx.win(); totalScore += snap.score; nightsWonRun = Math.min(3, nightsWonRun + 1); } else sfx.lose();
      const isDawn = won && currentNight === 3;
      $("res-title").textContent = isDawn ? "🌅 Bình Minh trên Đảo Đèn Lồng!" : (won ? `Hoàn thành Đêm ${currentNight}!` : "Sương đen đã nuốt ánh sáng…");
      $("res-desc").textContent = isDawn
        ? "Cả ba hòn đảo đã rực sáng. Mây đã hoàn thành sứ mệnh của người giữ đèn!"
        : (won ? "Mọi Đèn Lồng Lớn trên đảo đã được thắp sáng." : (ev.data.reason === "no_flames" ? "Mây đã mất hết Ngọn Lửa." : "Bình minh đã tới trước khi kịp giữ đủ đèn sáng."));
      $("res-score").textContent = isDawn ? `Tổng điểm cả 3 Đêm: ${totalScore}` : `Điểm Đêm ${currentNight}: ${snap.score}`;
      $("btn-next").style.display = (won && currentNight < 3) ? "block" : "none";
      // Ticket-04 mục 3: nhập tên khi thắng Đêm 3 Bình Minh HOẶC thua ở bất kỳ Đêm nào
      const canSave = isDawn || !won;
      $("lb-save").style.display = canSave ? "block" : "none";
      if (canSave) {
        $("lb-name").value = "";
        $("lb-status").textContent = "";
        $("btn-save-score").disabled = false;
      }
      showOnly("screen-result");
    }
  }
}

// ═══ Ticket-04 mục 1: chế độ Benchmark ═══
let benchState = null;

function initBench() {
  document.body.classList.add("bench");
  const rng = createRng(BENCH_SEED);
  const lanterns = MAPS[1].lanterns.map((l, i) => ({
    id: l.id,
    pos: [l.x, l.y, l.z],
    lit: i < 3, // L1–L3 sáng fuel 100
    fuel: i < 3 ? T.fuel_max : 0,
    deposited: i < 3 ? T.lantern_cost : 0,
  }));
  const motes = [];
  for (let i = 0; i < 100; i++) {
    const r = 3 + rng() * 35;
    const a = rng() * Math.PI * 2;
    motes.push({ id: `M${i + 1}`, pos: [r * Math.cos(a), 0, r * Math.sin(a)], kind: "random" });
  }
  const shades = [];
  for (let i = 0; i < 200; i++) {
    const r = rng() * 38; // rải đều trong đảo, r ≤ 38
    const a = rng() * Math.PI * 2;
    const x = r * Math.cos(a);
    const z = r * Math.sin(a);
    const d = rng() * Math.PI * 2;
    shades.push({ id: `S${i + 1}`, pos: [x, 1, z], state: "wander", sim: { x, z, dx: Math.cos(d), dz: Math.sin(d), timer: 0 } });
  }
  buildMapScene(1);
  mayGroup.position.set(0, 0, 0);
  mayGroup.visible = true;
  benchState = { rng, lanterns, motes, shades, first: null, lastNow: 0, warmupEnd: 0, measuring: false, measureStart: 0, dts: [], done: false, loadMs: null };
}

// Bóng Mực bench tự di chuyển theo luật wander: đổi hướng ngẫu nhiên (rng seed),
// bị chặn ở mép đảo và ngoài vùng an toàn bán kính 6 của L1–L3 (đổi hướng khi chạm).
function benchSimShades(dtSec) {
  const st = benchState;
  const litL = st.lanterns.filter((l) => l.lit);
  const speed = LAWS.shadeWanderSpeed;
  for (const s of st.shades) {
    const sim = s.sim;
    sim.timer += dtSec;
    if (sim.timer >= 2) {
      sim.timer = 0;
      const a = st.rng() * Math.PI * 2;
      sim.dx = Math.cos(a);
      sim.dz = Math.sin(a);
    }
    const nx = sim.x + sim.dx * speed * dtSec;
    const nz = sim.z + sim.dz * speed * dtSec;
    let blocked = Math.hypot(nx, nz) > 39; // mép đảo Đêm 1 (bán kính 40, đệm 1 m)
    if (!blocked) {
      for (const l of litL) {
        if (Math.hypot(nx - l.pos[0], nz - l.pos[2]) < T.safe_radius) { blocked = true; break; }
      }
    }
    if (blocked) {
      sim.dx = -sim.dx;
      sim.dz = -sim.dz;
    } else {
      sim.x = nx;
      sim.z = nz;
    }
    s.pos[0] = sim.x;
    s.pos[2] = sim.z;
  }
}

function benchSnap() {
  const st = benchState;
  return {
    tick: 0,
    sim_tick: 0,
    state: "playing",
    night: 1,
    time_left_s: 9999, // không kết thúc
    score: 0,
    wind: { active: false, dir_deg: 0 },
    player: {
      pos: [0, 0, 0], vel: [0, 0, 0], grounded: true, invuln: false,
      dash_cd_s: 0, pulse_cd_s: 0, charm_s: 0, flames: 3, carried: 0, capacity: T.carry_capacity,
    },
    lanterns: st.lanterns,
    motes: st.motes,
    shades: st.shades,
    drifters: [],
    charms: [],
  };
}

function benchFrame(now) {
  const st = benchState;
  if (st.done) return;
  if (st.first === null) {
    st.first = now;
    st.lastNow = now;
    st.warmupEnd = now + 3000; // 3 s khởi động (không đo)
    st.loadMs = Date.now() - BENCH_T0; // load_ms tính ở khung hình đầu tiên
  }
  const dtMs = now - st.lastNow;
  st.lastNow = now;
  const tSec = (now - st.first) / 1000;

  benchSimShades(Math.min(Math.max(dtMs, 0) / 1000, 0.25));
  // Camera bay tròn: tâm (0,0,0), r=30, Y=15, 15 s/vòng, ngược chiều kim đồng hồ, xuất phát (30,15,0)
  const a = (2 * Math.PI * tSec) / 15;
  camera.position.set(30 * Math.cos(a), 15, 30 * Math.sin(a));
  camera.lookAt(0, 0, 0);
  syncEntities(benchSnap(), tSec);

  if (!st.measuring && now >= st.warmupEnd) {
    st.measuring = true;
    st.measureStart = now;
  }
  if (st.measuring) {
    st.dts.push(dtMs);
    if (now - st.measureStart >= BENCH_DURATION * 1000) finishBench();
  }
}

function finishBench() {
  const st = benchState;
  st.done = true;
  const sorted = st.dts.slice().sort((x, y) => x - y);
  const n = sorted.length;
  const sum = sorted.reduce((s, v) => s + v, 0);
  // p1_low_fps: 1% khung chậm nhất (k dt lớn nhất), fps = 1000/mean(top k)
  const k = Math.max(1, Math.ceil(0.01 * n));
  const worst = sorted.slice(Math.max(0, n - k));
  const meanWorst = worst.reduce((s, v) => s + v, 0) / worst.length;
  const payload = {
    contract_version: "1.3",
    frames: n,
    avg_fps: n > 0 ? (1000 * n) / sum : 0,
    p1_low_fps: meanWorst > 0 ? 1000 / meanWorst : 0,
    frame_ms_p95: n > 0 ? sorted[Math.max(0, Math.ceil(0.95 * n) - 1)] : 0, // phân vị 95 (nearest-rank)
    load_ms: st.loadMs,
    peak_mem_mb: null, // trình duyệt không cho đo bộ nhớ GPU/renderer qua rAF chuẩn → null (giải thích Ticket-04 mục 1)
    vsync_off: true,
    renderer: "Three.js 0.170.0 (WebGL2)",
  };
  renderer.setAnimationLoop(null); // dừng vòng lặp sau khi đo xong
  fetch("/__bench_done", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => console.warn("bench: không gửi được /__bench_done (chạy ngoài bench runner?)", payload));
}

if (BENCH) initBench();

let acc = 0, lastNow = performance.now();
let fpsFrames = 0, fpsTimer = lastNow;

renderer.setAnimationLoop((now) => {
  if (BENCH) {
    benchFrame(now);
    renderer.render(scene, camera);
    return;
  }
  const dt = Math.min((now - lastNow) / 1000, 0.25);
  lastNow = now;
  fpsFrames++;
  if (now - fpsTimer >= 500) {
    $("fps-hud").textContent = `FPS: ${Math.round((fpsFrames * 1000) / (now - fpsTimer))}`;
    fpsFrames = 0;
    fpsTimer = now;
  }

  if (world && (mode === "playing" || mode === "paused")) {
    if (mode === "playing" && keys.has("KeyQ")) camYawDeg = (camYawDeg - 110 * dt) % 360;
    acc += dt;
    while (acc >= DT) {
      // Camera đứng sau Mây phía -Z, quay về +Z (yaw 0): W = tiến về +Z, A = trái (+X).
      // Core xoay input theo cam_yaw_deg: vx = mx·cos + mz·sin; vz = -mx·sin + mz·cos.
      const mx = (keys.has(settings.keys.left) ? 1 : 0) - (keys.has(settings.keys.right) ? 1 : 0);
      const mz = (keys.has(settings.keys.up) ? 1 : 0) - (keys.has(settings.keys.down) ? 1 : 0);
      if (edgePress.jump && world.player.grounded && mode === "playing") sfx.jump();
      const input = {
        move: mode === "playing" ? [mx, mz] : [0, 0],
        cam_yaw_deg: camYawDeg,
        jump: edgePress.jump,
        interact: edgePress.interact,
        pulse: edgePress.pulse,
        dash: edgePress.dash,
        pause: edgePress.pause,
      };
      edgePress.jump = edgePress.interact = edgePress.pulse = edgePress.dash = edgePress.pause = false;
      const events = step(world, input);
      const snap = snapshot(world);
      if (events.length) handleEvents(events, snap);
      acc -= DT;
      if (world.state !== "playing") break;
    }

    const snap = snapshot(world);
    const [px, py, pz] = snap.player.pos;
    mayGroup.position.set(px, py, pz);
    // Ticket-04 mục 4: "Giảm chuyển động" tắt hiệu ứng chớp (Mây nhấp nháy khi bất tử)
    mayGroup.visible = settings.reduceMotion ? true : !(snap.player.invuln && Math.floor(now / 80) % 2 === 0);

    const rad = (camYawDeg * Math.PI) / 180;
    const camDist = 9.5;
    camera.position.set(px - Math.sin(rad) * camDist, py + 4.8, pz - Math.cos(rad) * camDist);
    camera.lookAt(px, py + 1.3, pz);

    if (pulseFxT > 0 && !settings.reduceMotion) {
      pulseFxT = Math.max(0, pulseFxT - dt);
      const prog = 1 - pulseFxT / 0.35;
      pulseRing.position.set(px, py + 0.8, pz);
      pulseRing.scale.setScalar(1 + prog * T.pulse_radius);
      pulseRing.material.opacity = (1 - prog) * 0.85;
    } else {
      pulseFxT = 0;
      pulseRing.material.opacity = 0;
    }

    if (leafPoints.visible) {
      const posArr = leafGeo.attributes.position.array;
      const wr = (snap.wind.dir_deg * Math.PI) / 180;
      const wx = Math.cos(wr) * 10 * dt, wz = Math.sin(wr) * 10 * dt;
      for (let i = 0; i < LEAF_COUNT; i++) {
        posArr[i * 3] = ((posArr[i * 3] + wx + 35) % 70) - 35;
        posArr[i * 3 + 2] = ((posArr[i * 3 + 2] + wz + 35) % 70) - 35;
      }
      leafGeo.attributes.position.needsUpdate = true;
    }

    syncEntities(snap, now / 1000);
    updateHud(snap);
  } else {
    const a = now * 0.0002;
    camera.position.set(Math.sin(a) * 32, 16, Math.cos(a) * 32);
    camera.lookAt(0, 1, 0);
  }

  renderer.render(scene, camera);
});
