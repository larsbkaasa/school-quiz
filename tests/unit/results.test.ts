import { describe, expect, it } from "vitest";
import { present } from "../../src/domain/evaluate";
import { seededRng } from "../../src/domain/random";
import { computeResults, isLow } from "../../src/domain/results";
import {
  answer,
  createSession,
  current,
  next,
  type Presenter,
  type SessionState,
} from "../../src/domain/session";
import { pack, tf } from "../fixtures";

const presenter: Presenter = (q) => present(q, seededRng(1), { true: "Sant", false: "Usant" });
const pick = (s: SessionState, correct: boolean) => {
  const p = current(s)!;
  return p.options.findIndex((o) => (o.value === p.question.answer) === correct);
};

describe("results", () => {
  it("counts first attempts per aim, in pack aim order", () => {
    const qs = [tf("t-0001", "a-2", true), tf("t-0002", "a-1", true), tf("t-0003", "a-2", false)];
    const p = pack(qs);
    let s = createSession(qs, presenter);
    // a-2 right, a-1 wrong, a-2 wrong, then the two retries right.
    for (const correct of [true, false, false, true, true]) {
      s = answer(s, pick(s, correct), presenter).state;
      s = next(s).state;
    }
    const r = computeResults(s, p.aims);
    expect(r.total).toBe(3);
    expect(r.correct).toBe(1);
    expect(r.wrongIds.sort()).toEqual(["t-0002", "t-0003"]);
    expect(r.perAim).toEqual([
      { aimId: "a-1", attempted: 1, correct: 0 },
      { aimId: "a-2", attempted: 2, correct: 1 },
    ]);
  });

  it("omits aims with no attempts", () => {
    const qs = [tf("t-0001", "a-1", true)];
    const s = answer(createSession(qs, presenter), 0, presenter).state;
    expect(computeResults(s, pack(qs).aims).perAim.map((a) => a.aimId)).toEqual(["a-1"]);
  });

  it("isLow flags bars under 50 %", () => {
    expect(isLow({ aimId: "a", attempted: 4, correct: 1 })).toBe(true);
    expect(isLow({ aimId: "a", attempted: 4, correct: 2 })).toBe(false);
    expect(isLow({ aimId: "a", attempted: 0, correct: 0 })).toBe(false);
  });
});
