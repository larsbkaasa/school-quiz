import { describe, expect, it } from "vitest";
import { correctOptionIndex, isCorrect, present } from "../../src/domain/evaluate";
import { seededRng } from "../../src/domain/random";
import { single, tf } from "../fixtures";

const labels = { true: "Sant", false: "Usant" };

describe("evaluate", () => {
  it("single: shuffles options but keeps the original index as value", () => {
    const q = single("t-0001", "a-1", { options: ["A", "B", "C", "D"], answer: 2 });
    const seen = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      const p = present(q, seededRng(seed), labels);
      seen.add(p.options.map((o) => o.label).join());
      expect(p.options.map((o) => o.label).sort()).toEqual(["A", "B", "C", "D"]);
      expect(p.options[correctOptionIndex(p)]?.label).toBe("C");
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("tf: fixed order Sant, Usant", () => {
    const p = present(tf("t-0002", "a-1", false), seededRng(3), labels);
    expect(p.options).toEqual([
      { label: "Sant", value: true },
      { label: "Usant", value: false },
    ]);
    expect(correctOptionIndex(p)).toBe(1);
  });

  it("isCorrect compares by value", () => {
    expect(isCorrect(single("t-0003", "a-1", { answer: 1 }), 1)).toBe(true);
    expect(isCorrect(single("t-0003", "a-1", { answer: 1 }), 0)).toBe(false);
    expect(isCorrect(tf("t-0004", "a-1", true), true)).toBe(true);
    expect(isCorrect(tf("t-0004", "a-1", true), false)).toBe(false);
  });

  it("every presentation gets a unique key", () => {
    const q = single("t-0005", "a-1");
    expect(present(q, seededRng(1), labels).key).not.toBe(present(q, seededRng(1), labels).key);
  });
});
