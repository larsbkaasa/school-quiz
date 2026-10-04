import { describe, expect, it } from "vitest";
import { buildDeck, missedCount, priority, selectPool } from "../../src/domain/deck";
import { seededRng } from "../../src/domain/random";
import type { StatsMap } from "../../src/domain/types";
import { single } from "../fixtures";

const stat = (lastWrong: boolean, seen = 1) => ({
  seen,
  correct: lastWrong ? 0 : 1,
  lastWrong,
  lastSeen: "2026-10-01",
});

const questions = Array.from({ length: 12 }, (_, i) =>
  single(`t-${String(i + 1).padStart(4, "0")}`, i < 6 ? "a-1" : "a-2"),
);
const allAims = new Set(["a-1", "a-2"]);

describe("deck", () => {
  it("priority: wrong → 0, unseen → 1, known → 2", () => {
    const stats: StatsMap = { "t-0001": stat(true), "t-0002": stat(false) };
    expect(priority(questions[0]!, stats)).toBe(0);
    expect(priority(questions[1]!, stats)).toBe(2);
    expect(priority(questions[2]!, stats)).toBe(1);
  });

  it("filters by aim", () => {
    const pool = selectPool(questions, {}, { aims: new Set(["a-2"]), length: "all" });
    expect(pool.map((q) => q.aim)).toEqual(Array(6).fill("a-2"));
  });

  it("takes previously wrong, then unseen, then known", () => {
    const stats: StatsMap = {};
    // t-0001..t-0002 wrong, t-0003..t-0010 known, t-0011..t-0012 unseen
    for (let i = 1; i <= 10; i++) stats[`t-${String(i).padStart(4, "0")}`] = stat(i <= 2);
    for (let seed = 0; seed < 10; seed++) {
      const deck = buildDeck(questions, stats, { aims: allAims, length: 4 }, seededRng(seed));
      expect(deck.map((q) => q.id).sort()).toEqual(["t-0001", "t-0002", "t-0011", "t-0012"]);
    }
  });

  it("'all' returns the whole pool, shuffled", () => {
    const deck = buildDeck(questions, {}, { aims: allAims, length: "all" }, seededRng(7));
    expect(deck).toHaveLength(12);
    expect(deck.map((q) => q.id)).not.toEqual(questions.map((q) => q.id));
  });

  it("length larger than the pool returns the pool", () => {
    expect(buildDeck(questions, {}, { aims: new Set(["a-1"]), length: 20 }, seededRng(1))).toHaveLength(6);
  });

  it("onlyMissed and ids restrict the pool", () => {
    const stats: StatsMap = { "t-0001": stat(true), "t-0007": stat(true), "t-0002": stat(false) };
    expect(missedCount(questions, stats, allAims)).toBe(2);
    expect(missedCount(questions, stats, new Set(["a-1"]))).toBe(1);
    const missed = buildDeck(
      questions,
      stats,
      { aims: allAims, length: "all", onlyMissed: true },
      seededRng(1),
    );
    expect(missed.map((q) => q.id).sort()).toEqual(["t-0001", "t-0007"]);
    const byIds = buildDeck(
      questions,
      {},
      { aims: allAims, length: "all", ids: new Set(["t-0003"]) },
      seededRng(1),
    );
    expect(byIds.map((q) => q.id)).toEqual(["t-0003"]);
  });
});
