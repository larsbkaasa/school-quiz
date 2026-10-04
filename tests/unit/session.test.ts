import { describe, expect, it } from "vitest";
import { present } from "../../src/domain/evaluate";
import { seededRng } from "../../src/domain/random";
import {
  answer,
  applyStatsUpdate,
  createSession,
  current,
  isFinished,
  isoDate,
  next,
  REQUEUE_OFFSET,
  skipCurrent,
  type Presenter,
  type SessionState,
} from "../../src/domain/session";
import type { Question } from "../../src/domain/types";
import { single, tf } from "../fixtures";

const rng = seededRng(1);
const presenter: Presenter = (q) => present(q, rng, { true: "Sant", false: "Usant" });

const deck: Question[] = Array.from({ length: 6 }, (_, i) =>
  tf(`t-${String(i + 1).padStart(4, "0")}`, "a-1", true),
);

/** Index of the option (in presented order) that is correct / wrong for the current question. */
const pick = (s: SessionState, correct: boolean) => {
  const p = current(s)!;
  return p.options.findIndex((o) => (o.value === p.question.answer) === correct);
};

describe("session", () => {
  it("records first attempts and emits stats updates", () => {
    let s = createSession(deck, presenter);
    const out = answer(s, pick(s, true), presenter);
    expect(out.result.correct).toBe(true);
    expect(out.result.requeued).toBe(false);
    expect(out.statsUpdate).toEqual({ id: "t-0001", correct: true, firstAttempt: true });
    s = out.state;
    expect(s.firstAttempt.get("t-0001")).toBe(true);
    expect(() => answer(s, 0, presenter)).toThrow(/already answered/);
  });

  it("re-queues a wrong answer once, REQUEUE_OFFSET positions later", () => {
    let s = createSession(deck, presenter);
    const out = answer(s, pick(s, false), presenter);
    expect(out.result.correct).toBe(false);
    expect(out.result.requeued).toBe(true);
    expect(out.result.correctLabel).toBe("Sant");
    s = out.state;
    expect(s.queue).toHaveLength(7);
    expect(s.queue[REQUEUE_OFFSET]!.question.id).toBe("t-0001");
    expect(s.queue[REQUEUE_OFFSET]!.key).not.toBe(s.queue[0]!.key);
  });

  it("re-queues at the end when close to the end of the queue", () => {
    let s = createSession(deck.slice(0, 2), presenter);
    s = answer(s, pick(s, true), presenter).state;
    s = next(s).state;
    s = answer(s, pick(s, false), presenter).state;
    expect(s.queue.map((p) => p.question.id)).toEqual(["t-0001", "t-0002", "t-0002"]);
  });

  it("does not re-queue a second time, and a retry does not change the score", () => {
    let s = createSession(deck.slice(0, 1), presenter);
    s = answer(s, pick(s, false), presenter).state;
    let n = next(s);
    expect(n.finished).toBe(false);
    s = n.state;
    const retry = answer(s, pick(s, false), presenter);
    expect(retry.result.requeued).toBe(false);
    expect(retry.statsUpdate).toBeUndefined();
    n = next(retry.state);
    expect(n.finished).toBe(true);
    expect(n.state.firstAttempt.get("t-0001")).toBe(false);
  });

  it("a correct retry emits lastWrong=false but keeps first-attempt scoring", () => {
    let s = createSession(deck.slice(0, 1), presenter);
    s = answer(s, pick(s, false), presenter).state;
    s = next(s).state;
    const retry = answer(s, pick(s, true), presenter);
    expect(retry.statsUpdate).toEqual({ id: "t-0001", correct: true, firstAttempt: false });
    expect(retry.state.firstAttempt.get("t-0001")).toBe(false);
  });

  it("tracks outcomes per presentation for the progress dots", () => {
    let s = createSession(deck, presenter);
    s = answer(s, pick(s, false), presenter).state;
    expect(s.outcomes.get(s.queue[0]!.key)).toBe(false);
    expect(s.outcomes.has(s.queue[REQUEUE_OFFSET]!.key)).toBe(false);
  });

  it("skipCurrent removes the question, including re-queued copies", () => {
    const qs = [single("t-0001", "a-1"), single("t-0002", "a-1"), single("t-0003", "a-1")];
    let s = createSession(qs, presenter);
    s = next(answer(s, pick(s, true), presenter).state).state;
    const skipped = skipCurrent(s);
    expect(skipped.finished).toBe(false);
    expect(skipped.state.queue.map((p) => p.question.id)).toEqual(["t-0001", "t-0003"]);
    expect(current(skipped.state)!.question.id).toBe("t-0003");
    const last = skipCurrent(skipped.state);
    expect(last.finished).toBe(true);
    expect(isFinished(last.state)).toBe(true);
  });

  it("applyStatsUpdate", () => {
    const first = applyStatsUpdate(undefined, { id: "x", correct: false, firstAttempt: true }, "2026-10-04");
    expect(first).toEqual({ seen: 1, correct: 0, lastWrong: true, lastSeen: "2026-10-04" });
    const second = applyStatsUpdate(first, { id: "x", correct: true, firstAttempt: true }, "2026-10-05");
    expect(second).toEqual({ seen: 2, correct: 1, lastWrong: false, lastSeen: "2026-10-05" });
    const retry = applyStatsUpdate(first, { id: "x", correct: true, firstAttempt: false }, "2026-10-04");
    expect(retry).toEqual({ seen: 1, correct: 0, lastWrong: false, lastSeen: "2026-10-04" });
  });

  it("isoDate uses the local calendar date", () => {
    expect(isoDate(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
});
