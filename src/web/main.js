// Hiển thị 3D (Three.js) + HUD + Luồng 3 Đêm — chỉ đọc state từ src/core/, KHÔNG chứa luật chơi.
import * as THREE from "three";
import { createWorld, step, snapshot } from "../core/world.js";
import { MAPS } from "../core/maps.js";
import { TUNING as T, DT, LAWS } from "../core/config.js";
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
    goal: "Thắp 5 đèn lồng (10 đom đóm / đèn) · Thời gian: 05:00",
  },
  2: {
    title: "Đêm 2 — Đảo Cau",
    quote: "Ông Đăng: “Cầu tre nối hai bờ đảo rất hẹp, lại có Gió Lạc hay rình cướp ánh sáng. Dùng bục nhảy và Bùa Gió cho khéo nhé cháu!”",
    goal: "Thắp 6 đèn lồng trên hai đảo · Thời gian: 05:30",
  },
  3: {
    title: "Đêm 3 — Đảo Chuông",
    quote: "Ông Đăng: “Đỉnh tháp chuông là ngọn đèn cuối cùng. Gió lớn trên đảo rất mạnh, nhưng ánh sáng của cháu sẽ dẫn lối cho cả biển mây.”",
    goal: "Thắp 7 đèn lồng qua 3 tầng đảo · Thời gian: 06:00",
  },
};

const SETTINGS_KEY = "dao_den_long_settings_v1";
const settings = (() => {
  try {
    return { volume: 0.6, sensitivity: 1.0, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
  } catch {
    return { volume: 0.6, sensitivity: 1.0 };
  }
})();
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {}
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
    g.add(pole, bulb, light);
    g.position.set(l.x, l.y, l.z);
    mapGroup.add(g);
    lanternMeshes.set(l.id, { group: g, bulbMat, light });
  }
}

const moteGeo = new THREE.SphereGeometry(0.24, 10, 8);
const moteMatRand = new THREE.MeshBasicMaterial({ color: PAL.moteCore });
const moteMatDrop = new THREE.MeshBasicMaterial({ color: PAL.moteHalo });

function syncEntities(snap, tSec) {
  let litCount = 0;
  for (const l of snap.lanterns) {
    if (l.lit) litCount++;
    const m = lanternMeshes.get(l.id);
    if (!m) continue;
    if (l.lit) {
      m.bulbMat.color.setHex(PAL.lanternCore);
      m.bulbMat.emissive.setHex(PAL.lanternLit);
      m.bulbMat.emissiveIntensity = 1.2;
      m.light.intensity = 2.6;
    } else {
      m.bulbMat.color.setHex(PAL.lanternOff);
      m.bulbMat.emissive.setHex(l.deposited > 0 ? PAL.lanternLit : 0x000000);
      m.bulbMat.emissiveIntensity = (l.deposited / T.lantern_cost) * 0.5;
      m.light.intensity = 0;
    }
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
      obj.mat.emissive.setHex(PAL.shadeRim);
      obj.mat.emissiveIntensity = s.state === "chase" ? 1.0 : 0.45;
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
for (let i = 0; i < T.carry_capacity; i++) {
  const d = document.createElement("div");
  d.className = "mote-slot";
  moteBarEl.appendChild(d);
}
const moteSlots = [...moteBarEl.children];

let mode = "menu";
let currentNight = 1;
let totalScore = 0;
let world = null;
let camYawDeg = 0;
let lastCountdownSec = 11;
let settingsReturnTo = "menu";

const keys = new Set();
const edgePress = { jump: false, interact: false, pulse: false, dash: false, pause: false };

function showOnly(screenId) {
  for (const id of ["screen-menu", "screen-intro", "screen-pause", "screen-settings", "screen-result"]) {
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
  world = createWorld({ seed: night * 101 + 7, night });
  buildMapScene(night);
  camYawDeg = 0;
  lastCountdownSec = 11;
  mode = "playing";
  $("night-label").textContent = `Đêm ${night} — ${MAPS[night].name}`;
  showOnly(null);
}

function togglePause() {
  if (!world || (mode !== "playing" && mode !== "paused")) return;
  edgePress.pause = true;
}

$("btn-start").onclick = () => { totalScore = 0; openIntro(1); };
document.querySelectorAll("[data-night]").forEach((b) => {
  b.onclick = () => { totalScore = 0; openIntro(Number(b.dataset.night)); };
});
$("btn-intro-go").onclick = () => startNight(currentNight);
$("btn-resume").onclick = () => togglePause();
$("btn-retry-pause").onclick = () => startNight(currentNight);
$("btn-to-menu").onclick = () => { mode = "menu"; world = null; showOnly("screen-menu"); };
$("btn-retry-res").onclick = () => startNight(currentNight);
$("btn-res-menu").onclick = () => { mode = "menu"; world = null; showOnly("screen-menu"); };
$("btn-next").onclick = () => openIntro(currentNight + 1);

function openSettings(from) {
  settingsReturnTo = from;
  $("opt-vol").value = Math.round(settings.volume * 100);
  $("val-vol").textContent = `${Math.round(settings.volume * 100)}%`;
  $("opt-sens").value = settings.sensitivity;
  $("val-sens").textContent = `${settings.sensitivity.toFixed(1)}x`;
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
$("btn-settings-close").onclick = () => {
  saveSettings();
  showOnly(settingsReturnTo === "pause" ? "screen-pause" : "screen-menu");
};

addEventListener("keydown", (e) => {
  sfx.unlock();
  if (!keys.has(e.code)) {
    if (e.code === "Space") edgePress.jump = true;
    if (e.code === "KeyE") edgePress.interact = true;
    if (e.code === "KeyF") edgePress.pulse = true;
    if (e.code === "ShiftLeft" || e.code === "ShiftRight") edgePress.dash = true;
    if (e.code === "Escape" || e.code === "KeyP") togglePause();
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

const projVec = new THREE.Vector3();
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
  timerEl.textContent = `${mm}:${ss}`;
  timerEl.classList.toggle("urgent", sec <= 30);
  if (sec <= 10 && sec > 0 && sec < lastCountdownSec) {
    lastCountdownSec = sec;
    sfx.countdown();
  }
  const lit = snap.lanterns.filter((l) => l.lit).length;
  $("lanterns-hud").textContent = `🏮 ${lit} / ${snap.lanterns.length}`;
  $("score-hud").textContent = `Điểm: ${snap.score}`;

  for (let i = 0; i < moteSlots.length; i++) {
    moteSlots[i].classList.toggle("filled", i < snap.player.carried);
  }

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
  bWind.textContent = snap.wind.active ? `Gió mạnh (${Math.round(snap.wind.dir_deg)}°)` : "Sắp có gió mạnh…";
  leafPoints.visible = snap.wind.active || windWarn;

  let nearest = null, bestD = Infinity;
  const px = snap.player.pos[0], pz = snap.player.pos[2];
  for (const l of snap.lanterns) {
    if (l.lit) continue;
    const d = Math.hypot(l.pos[0] - px, l.pos[2] - pz);
    if (d < bestD) { bestD = d; nearest = l; }
  }
  const promptE = $("prompt-e");
  if (nearest && bestD <= T.interact_radius) {
    promptE.style.display = "block";
    promptE.textContent = `E — Nạp ánh sáng (${nearest.deposited}/${T.lantern_cost})`;
  } else {
    promptE.style.display = "none";
  }

  const arrow = $("offscreen-arrow");
  if (nearest && mode === "playing") {
    projVec.set(nearest.pos[0], nearest.pos[1] + 3.4, nearest.pos[2]).project(camera);
    const inFront = projVec.z < 1;
    const onScreen = inFront && Math.abs(projVec.x) <= 0.95 && Math.abs(projVec.y) <= 0.95;
    if (!onScreen) {
      const nx = inFront ? projVec.x : -projVec.x;
      const ny = inFront ? projVec.y : -projVec.y;
      const ang = Math.atan2(-ny, nx);
      const pad = 42, cx = innerWidth / 2, cy = innerHeight / 2;
      const scale = Math.min((cx - pad) / Math.max(0.001, Math.abs(Math.cos(ang))), (cy - pad) / Math.max(0.001, Math.abs(Math.sin(ang))));
      arrow.style.display = "flex";
      arrow.style.left = `${cx + Math.cos(ang) * scale}px`;
      arrow.style.top = `${cy + Math.sin(ang) * scale}px`;
      arrow.style.transform = `rotate(${ang}rad)`;
    } else {
      arrow.style.display = "none";
    }
  } else {
    arrow.style.display = "none";
  }
}

function handleEvents(events, snap) {
  for (const ev of events) {
    if (ev.name === "mote_picked") sfx.pickup();
    else if (ev.name === "deposit") sfx.deposit();
    else if (ev.name === "lantern_lit") sfx.lanternLit();
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
      if (won) { sfx.win(); totalScore += snap.score; } else sfx.lose();
      const isDawn = won && currentNight === 3;
      $("res-title").textContent = isDawn ? "🌅 Bình Minh trên Đảo Đèn Lồng!" : (won ? `Hoàn thành Đêm ${currentNight}!` : "Sương đen đã nuốt ánh sáng…");
      $("res-desc").textContent = isDawn
        ? "Cả ba hòn đảo đã rực sáng. Mây đã hoàn thành sứ mệnh của người giữ đèn!"
        : (won ? "Mọi Đèn Lồng Lớn trên đảo đã được thắp sáng." : (ev.data.reason === "no_flames" ? "Mây đã mất hết Ngọn Lửa." : "Bình minh đã tới trước khi kịp thắp hết đèn."));
      $("res-score").textContent = isDawn ? `Tổng điểm cả 3 Đêm: ${totalScore}` : `Điểm Đêm ${currentNight}: ${snap.score}`;
      $("btn-next").style.display = (won && currentNight < 3) ? "block" : "none";
      showOnly("screen-result");
    }
  }
}

let acc = 0, lastNow = performance.now();
let fpsFrames = 0, fpsTimer = lastNow;

renderer.setAnimationLoop((now) => {
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
      const mx = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
      const mz = (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") ? 1 : 0);
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
    mayGroup.visible = !(snap.player.invuln && Math.floor(now / 80) % 2 === 0);

    const rad = (camYawDeg * Math.PI) / 180;
    const camDist = 9.5;
    camera.position.set(px - Math.sin(rad) * camDist, py + 4.8, pz - Math.cos(rad) * camDist);
    camera.lookAt(px, py + 1.3, pz);

    if (pulseFxT > 0) {
      pulseFxT = Math.max(0, pulseFxT - dt);
      const prog = 1 - pulseFxT / 0.35;
      pulseRing.position.set(px, py + 0.8, pz);
      pulseRing.scale.setScalar(1 + prog * T.pulse_radius);
      pulseRing.material.opacity = (1 - prog) * 0.85;
    } else {
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
