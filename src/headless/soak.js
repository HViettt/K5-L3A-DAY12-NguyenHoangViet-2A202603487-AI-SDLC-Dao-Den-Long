#!/usr/bin/env node
// Soak test theo Test Contract v1.3 (Ticket-04 mục 2).
// Lệnh: node src/headless/soak.js --seed 7 --nights 10 --out soak.json
import { writeFileSync } from "node:fs";
import { createWorld, step } from "../core/world.js";
import { createRng } from "../core/rng.js";
import { MAPS } from "../core/maps.js";
import { TICKS_PER_SECOND } from "../core/config.js";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) continue;
    const eq = a.indexOf("=");
    if (eq !== -1) args[a.slice(2, eq)] = a.slice(eq + 1);
    else {
      const k = a.slice(2);
      const v = argv[i + 1];
      if (v !== undefined && !v.startsWith("--")) { args[k] = v; i += 1; }
      else args[k] = "";
    }
  }
  return args;
}

const args = parseArgs(process.argv.slice(2));
const seed = Number.parseInt(args.seed ?? "7", 10);
const nights = Number.parseInt(args.nights ?? "10", 10);
const outPath = args.out;
if (!Number.isInteger(seed) || !Number.isInteger(nights) || nights < 1 || !outPath) {
  process.stderr.write("Usage: node src/headless/soak.js --seed <int> --nights <int> --out <soak.json>\n");
  process.exit(1);
}

const rssMb = () => Math.round((process.memoryUsage().rss / (1024 * 1024)) * 10) / 10;
const t0 = Date.now();
const results = [];
let crashes = 0;
let memStartMb = 0;

for (let i = 0; i < nights; i++) {
  const night = (i % 3) + 1;
  const nightSeed = seed + i;
  const rng = createRng(nightSeed ^ 0x9e3779b9);
  try {
    let w = createWorld({ seed: nightSeed, night });
    if (i === 0) memStartMb = rssMb();
    const maxTicks = Math.round(MAPS[night].duration_s * TICKS_PER_SECOND);
    let move = [0, 0];
    let prevJump = false, prevDash = false, prevPulse = false, prevInteract = false;

    for (let t = 0; t < maxTicks && w.state === "playing"; t++) {
      if (t % 30 === 0) {
        const ang = rng() * Math.PI * 2;
        move = [Math.cos(ang), Math.sin(ang)];
      }
      // Xác suất mỗi tick: 5% nhảy, 3% lướt, 2% tỏa sáng, 10% tương tác (tạo cạnh lên nếu trước đó false)
      const jump = !prevJump && rng() < 0.05;
      const dash = !prevDash && rng() < 0.03;
      const pulse = !prevPulse && rng() < 0.02;
      const interact = !prevInteract && rng() < 0.10;
      prevJump = jump; prevDash = dash; prevPulse = pulse; prevInteract = interact;
      step(w, { move, cam_yaw_deg: 0, jump, dash, pulse, interact });
    }
    results.push(w.state === "won" ? "won" : "lost");
    w = null; // reset sau Đêm
  } catch (e) {
    crashes += 1;
    results.push("crash");
    process.stderr.write(`soak night ${i} error: ${e.stack || e.message}\n`);
  }
}

const memEndMb = rssMb();
const durationS = Math.round(((Date.now() - t0) / 1000) * 100) / 100;
const out = {
  nights,
  crashes,
  results,
  mem_start_mb: memStartMb,
  mem_end_mb: memEndMb,
  duration_s: durationS,
};
writeFileSync(outPath, JSON.stringify(out, null, 2) + "\n", "utf8");
process.exit(crashes === 0 ? 0 : 1);
