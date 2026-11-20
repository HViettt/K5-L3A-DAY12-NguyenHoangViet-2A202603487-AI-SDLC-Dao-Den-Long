#!/usr/bin/env node
// Headless runner theo Test Contract v1.1 (docs/spec/ticket-02.md Phần 4).
// Mã thoát: 0 OK · 2 file inputs/scenario sai định dạng · 1 lỗi khác (thiếu/sai tham số, lỗi ghi file).
import { createWorld, step, snapshot } from "../core/world.js";
import { MAPS } from "../core/maps.js";
import { readFileSync, writeFileSync } from "node:fs";

function die(code, msg) {
  process.stderr.write(`cli: ${msg}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) die(1, `tham số lạ: ${a}`);
    const eq = a.indexOf("=");
    if (eq !== -1) {
      args[a.slice(2, eq)] = a.slice(eq + 1);
    } else {
      const key = a.slice(2);
      const val = argv[i + 1];
      if (val === undefined || val.startsWith("--")) {
        args[key] = "";
      } else {
        args[key] = val;
        i += 1;
      }
    }
  }
  return args;
}

function intArg(args, name, { required = false, def, min = -Infinity }) {
  if (args[name] === undefined || args[name] === "") {
    if (required) die(1, `thiếu tham số --${name}`);
    return def;
  }
  const v = Number(args[name]);
  if (!Number.isInteger(v) || v < min) {
    die(1, `--${name} phải là số nguyên ≥ ${min}`);
  }
  return v;
}

function loadJsonFile(path, label) {
  let raw;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    die(2, `${label}: không đọc được file ${path}`);
  }
  try {
    return JSON.parse(raw);
  } catch (e) {
    die(2, `${label}: JSON không hợp lệ (${e.message})`);
  }
}

function validateScenario(sc, night) {
  const err = (m) => {
    throw new Error(m);
  };
  const num = (v) => typeof v === "number" && Number.isFinite(v);
  const int = (v) => Number.isInteger(v);
  const vec3 = (v, what) => {
    if (!Array.isArray(v) || v.length !== 3 || !v.every(num)) err(`${what} phải là mảng [x,y,z] số`);
  };
  if (typeof sc !== "object" || sc === null || Array.isArray(sc)) err("phải là object");
  if (sc.player !== undefined) {
    if (typeof sc.player !== "object" || sc.player === null) err("player phải là object");
    if (sc.player.pos !== undefined) vec3(sc.player.pos, "player.pos");
    for (const k of ["carried", "flames", "invuln_ticks", "dash_cd_ticks", "pulse_cd_ticks", "charm_ticks", "successful_lights"]) {
      if (sc.player[k] !== undefined && !(int(sc.player[k]) && sc.player[k] >= 0)) {
        err(`player.${k} phải là số nguyên ≥ 0`);
      }
    }
  }
  for (const k of ["random_motes", "random_shades", "random_drifters", "wind_enabled"]) {
    if (sc[k] !== undefined && typeof sc[k] !== "boolean") err(`${k} phải là boolean`);
  }
  if (sc.motes !== undefined) {
    if (!Array.isArray(sc.motes)) err("motes phải là mảng");
    sc.motes.forEach((m, i) => vec3(m, `motes[${i}]`));
  }
  const shadeStates = ["spawning", "wander", "chase", "recoil", "stunned", "drain"];
  if (sc.shades !== undefined) {
    if (!Array.isArray(sc.shades)) err("shades phải là mảng");
    sc.shades.forEach((s, i) => {
      if (typeof s !== "object" || s === null) err(`shades[${i}] phải là object`);
      if (s.pos !== undefined) vec3(s.pos, `shades[${i}].pos`);
      if (s.id !== undefined && !/^S\d+$/.test(String(s.id))) err(`shades[${i}].id phải có dạng S<number>`);
      if (s.state !== undefined && !shadeStates.includes(s.state)) {
        err(`shades[${i}].state phải thuộc ${shadeStates.join(", ")}`);
      }
      if (s.state_ticks_left !== undefined && !(int(s.state_ticks_left) && s.state_ticks_left >= 0)) {
        err(`shades[${i}].state_ticks_left phải là số nguyên ≥ 0`);
      }
      if (s.target_lantern_id !== undefined && typeof s.target_lantern_id !== "string") {
        err(`shades[${i}].target_lantern_id phải là chuỗi`);
      }
    });
  }
  const drifterStates = ["idle", "chase", "flee", "removed"];
  if (sc.drifters !== undefined) {
    if (!Array.isArray(sc.drifters)) err("drifters phải là mảng");
    sc.drifters.forEach((d, i) => {
      if (typeof d !== "object" || d === null) err(`drifters[${i}] phải là object`);
      if (d.pos !== undefined) vec3(d.pos, `drifters[${i}].pos`);
      if (d.id !== undefined && !/^D\d+$/.test(String(d.id))) err(`drifters[${i}].id phải có dạng D<number>`);
      if (d.state !== undefined && !drifterStates.includes(d.state)) {
        err(`drifters[${i}].state phải thuộc ${drifterStates.join(", ")}`);
      }
      if (d.stolen !== undefined && !(int(d.stolen) && d.stolen >= 0)) {
        err(`drifters[${i}].stolen phải là số nguyên ≥ 0`);
      }
    });
  }
  if (sc.charms !== undefined) {
    if (!Array.isArray(sc.charms)) err("charms phải là mảng");
    sc.charms.forEach((c, i) => {
      if (typeof c !== "object" || c === null) err(`charms[${i}] phải là object`);
      if (c.id !== undefined && !/^C\d+$/.test(String(c.id))) err(`charms[${i}].id phải có dạng C<number>`);
      if (c.pos !== undefined) vec3(c.pos, `charms[${i}].pos`);
      if (c.available !== undefined && typeof c.available !== "boolean") {
        err(`charms[${i}].available phải là boolean`);
      }
    });
  }
  const maxL = MAPS[night].lanterns.length;
  if (sc.lanterns !== undefined) {
    if (!Array.isArray(sc.lanterns)) err("lanterns phải là mảng");
    sc.lanterns.forEach((l, i) => {
      if (typeof l !== "object" || l === null) err(`lanterns[${i}] phải là object`);
      const n = typeof l.id === "string" ? Number(l.id.slice(1)) : NaN;
      if (typeof l.id !== "string" || !l.id.startsWith("L") || !Number.isInteger(n) || n < 1 || n > maxL) {
        err(`lanterns[${i}].id phải là L1..L${maxL}`);
      }
      if (l.pos !== undefined) vec3(l.pos, `lanterns[${i}].pos`);
      if (l.deposited !== undefined && !(int(l.deposited) && l.deposited >= 0)) {
        err(`lanterns[${i}].deposited phải là số nguyên ≥ 0`);
      }
      if (l.lit !== undefined && typeof l.lit !== "boolean") err(`lanterns[${i}].lit phải là boolean`);
      if (l.fuel !== undefined && !(num(l.fuel) && l.fuel >= 0 && l.fuel <= 100)) {
        err(`lanterns[${i}].fuel phải là số trong [0,100]`);
      }
      if (l.ever_lit !== undefined && typeof l.ever_lit !== "boolean") err(`lanterns[${i}].ever_lit phải là boolean`);
    });
  }
  if (sc.time_left_s !== undefined && !(num(sc.time_left_s) && sc.time_left_s > 0)) {
    err("time_left_s phải là số > 0");
  }
}

function validateInputs(inp) {
  const err = (m) => {
    throw new Error(m);
  };
  if (typeof inp !== "object" || inp === null || Array.isArray(inp)) err("phải là object");
  if (!Array.isArray(inp.frames)) err("frames phải là mảng");
  let prev = -1;
  inp.frames.forEach((f, i) => {
    if (typeof f !== "object" || f === null) err(`frames[${i}] phải là object`);
    if (!Number.isInteger(f.tick) || f.tick < 0) err(`frames[${i}].tick phải là số nguyên ≥ 0`);
    if (f.tick <= prev) err(`frames[${i}].tick phải tăng nghiêm ngặt`);
    prev = f.tick;
    if (f.move !== undefined) {
      const ok =
        Array.isArray(f.move) &&
        f.move.length === 2 &&
        f.move.every((n) => typeof n === "number" && Number.isFinite(n) && n >= -1 && n <= 1);
      if (!ok) err(`frames[${i}].move phải là [x,z] với mỗi thành phần trong [-1,1]`);
    }
    if (f.cam_yaw_deg !== undefined && !(typeof f.cam_yaw_deg === "number" && Number.isFinite(f.cam_yaw_deg))) {
      err(`frames[${i}].cam_yaw_deg phải là số`);
    }
    for (const k of ["jump", "interact", "pulse", "dash", "pause"]) {
      if (f[k] !== undefined && typeof f[k] !== "boolean") err(`frames[${i}].${k} phải là boolean`);
    }
  });
}

// Trạng thái input từng tick: frame chỉ đổi trường có mặt, trường vắng giữ giá trị cũ.
function buildInputStates(frames, ticks) {
  const cur = {
    move: [0, 0],
    cam_yaw_deg: 0,
    jump: false,
    interact: false,
    pulse: false,
    dash: false,
    pause: false,
  };
  const states = [];
  let fi = 0;
  for (let t = 0; t < ticks; t++) {
    while (fi < frames.length && frames[fi].tick === t) {
      const f = frames[fi];
      if (f.move !== undefined) cur.move = [f.move[0], f.move[1]];
      if (f.cam_yaw_deg !== undefined) cur.cam_yaw_deg = f.cam_yaw_deg;
      if (f.jump !== undefined) cur.jump = f.jump;
      if (f.interact !== undefined) cur.interact = f.interact;
      if (f.pulse !== undefined) cur.pulse = f.pulse;
      if (f.dash !== undefined) cur.dash = f.dash;
      if (f.pause !== undefined) cur.pause = f.pause;
      fi += 1;
    }
    states.push({
      move: [cur.move[0], cur.move[1]],
      cam_yaw_deg: cur.cam_yaw_deg,
      jump: cur.jump,
      interact: cur.interact,
      pulse: cur.pulse,
      dash: cur.dash,
      pause: cur.pause,
    });
  }
  return states;
}

const args = parseArgs(process.argv.slice(2));
const seed = intArg(args, "seed", { required: true });
const night = intArg(args, "night", { required: true });
if (night !== 1 && night !== 2 && night !== 3) die(1, `--night phải là 1, 2 hoặc 3 (nhận: ${night})`);
const ticks = intArg(args, "ticks", { required: true, min: 0 });
const snapEvery = intArg(args, "snapshot-every", { min: 1, def: 10 });
const outPath = args.out;
if (outPath === undefined || outPath === "") die(1, "thiếu tham số --out");

let scenario = {};
if (args.scenario !== undefined && args.scenario !== "") {
  scenario = loadJsonFile(args.scenario, "scenario");
  try {
    validateScenario(scenario, night);
  } catch (e) {
    die(2, `scenario sai định dạng: ${e.message}`);
  }
}
let frames = [];
if (args.inputs !== undefined && args.inputs !== "") {
  const inp = loadJsonFile(args.inputs, "inputs");
  try {
    validateInputs(inp);
  } catch (e) {
    die(2, `inputs sai định dạng: ${e.message}`);
  }
  frames = inp.frames;
}

const world = createWorld({ seed, night, scenario });
const states = buildInputStates(frames, ticks);
const lines = [];
const push = (o) => lines.push(JSON.stringify(o));

// Snapshot tick 0 = trạng thái sau khi dựng scenario, trước khi áp input.
push({ type: "snapshot", ...snapshot(world) });
// night_start phát ngay sau snapshot tick 0 khi chạy bình thường (A2-3), không cộng điểm.
push({ type: "event", tick: 0, name: "night_start", data: { night } });
for (let k = 0; k < ticks; k++) {
  const evs = step(world, states[k]);
  for (const ev of evs) push({ type: "event", tick: world.tick, name: ev.name, data: ev.data });
  if (world.tick % snapEvery === 0) push({ type: "snapshot", ...snapshot(world) });
  if (world.state !== "playing") break; // dừng khi game kết thúc (thắng/thua)
}
if (world.tick % snapEvery !== 0) push({ type: "snapshot", ...snapshot(world) });
push({ type: "end", ticks: world.tick, state: world.state, score: world.score });

try {
  writeFileSync(outPath, lines.join("\n") + "\n");
} catch (e) {
  die(1, `không ghi được ${outPath}: ${e.message}`);
}
