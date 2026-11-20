import { test } from "node:test";
import assert from "node:assert/strict";
import { createRng } from "../src/core/rng.js";

test("RNG cùng seed cho cùng dãy số", () => {
  const a = createRng(42), b = createRng(42);
  for (let i = 0; i < 100; i++) assert.equal(a(), b());
});

test("RNG khác seed cho dãy khác", () => {
  assert.notEqual(createRng(1)(), createRng(2)());
});
