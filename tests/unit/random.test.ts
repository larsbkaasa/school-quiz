import { describe, expect, it } from "vitest";
import { seededRng, shuffle } from "../../src/domain/random";

describe("random", () => {
  it("seededRng is deterministic and in [0, 1)", () => {
    const a = seededRng(42);
    const b = seededRng(42);
    const xs = Array.from({ length: 100 }, () => a());
    expect(xs).toEqual(Array.from({ length: 100 }, () => b()));
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });

  it("shuffle returns a permutation without mutating the input", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffle(input, seededRng(1));
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort()).toEqual(input);
    expect(out).not.toEqual(input);
  });
});
