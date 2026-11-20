import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const run = (...a) => execFileSync(process.execPath, ["src/headless/cli.js", ...a], { encoding: "utf8" });

test("headless tất định: 2 lần cùng input ra cùng output", () => {
  assert.equal(run("--seed=7", "--ticks=120"), run("--seed=7", "--ticks=120"));
});

test("headless: 60 tick đi phải với tốc độ 4 -> x = 4", () => {
  const out = JSON.parse(run("--ticks=60"));
  assert.equal(out.tick, 60);
  assert.equal(out.player.x, 4);
});
