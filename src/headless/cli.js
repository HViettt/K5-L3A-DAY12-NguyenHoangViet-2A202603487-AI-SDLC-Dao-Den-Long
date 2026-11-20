#!/usr/bin/env node
// Headless runner (placeholder CP0). Định dạng input/output sẽ đổi theo Test Contract.
import { createWorld, step, snapshot } from "../core/world.js";

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => a.replace(/^--/, "").split("="))
);
const seed = Number(args.seed ?? 1);
const ticks = Number(args.ticks ?? 60);
const w = createWorld(seed);
for (let i = 0; i < ticks; i++) step(w, { dx: 1, dz: 0 });
process.stdout.write(JSON.stringify(snapshot(w)) + "\n");
