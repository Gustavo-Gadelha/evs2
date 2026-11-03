import assert from "node:assert/strict";
import test from "node:test";

import { reciprocalRankFusion } from "../fusion.ts";

test("quem aparece nos dois rankings sobe", () => {
  const fused = reciprocalRankFusion([
    ["A", "B", "C"],
    ["C", "D", "A"],
  ]);
  assert.deepEqual(
    fused.map((f) => f.id),
    ["A", "C", "B", "D"],
  );
});

test("ranking vazio e ids repetidos", () => {
  assert.deepEqual(reciprocalRankFusion([[], []]), []);
  const [only] = reciprocalRankFusion([["A", "A"]]);
  assert.equal(only.score, 1 / 61);
});

test("empate desempata pelo id, de forma estável", () => {
  const fused = reciprocalRankFusion([["B"], ["A"]]);
  assert.deepEqual(
    fused.map((f) => f.id),
    ["A", "B"],
  );
});
