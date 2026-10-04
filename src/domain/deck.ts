import { shuffle, type Rng } from "./random";
import type { Question, StatsMap } from "./types";

export type SessionLength = number | "all";

export interface DeckOptions {
  aims: ReadonlySet<string>;
  length: SessionLength;
  /** Only questions answered wrong last time ("Øv på det du bommet på sist"). */
  onlyMissed?: boolean;
  /** Restrict to exactly these ids (e.g. the wrong answers from the last session). */
  ids?: ReadonlySet<string>;
}

/** 0 = last answered wrong, 1 = never seen, 2 = known (§7.1). */
export function priority(question: Question, stats: StatsMap): 0 | 1 | 2 {
  const s = stats[question.id];
  if (s?.lastWrong) return 0;
  if (!s || s.seen === 0) return 1;
  return 2;
}

export function selectPool(questions: readonly Question[], stats: StatsMap, opts: DeckOptions): Question[] {
  return questions.filter(
    (q) =>
      opts.aims.has(q.aim) &&
      (!opts.ids || opts.ids.has(q.id)) &&
      (!opts.onlyMissed || stats[q.id]?.lastWrong === true),
  );
}

export function missedCount(
  questions: readonly Question[],
  stats: StatsMap,
  aims: ReadonlySet<string>,
): number {
  return questions.filter((q) => aims.has(q.aim) && stats[q.id]?.lastWrong === true).length;
}

/**
 * deck = shuffle(pool) → stable sort by priority → take N (or all) → shuffle
 */
export function buildDeck(
  questions: readonly Question[],
  stats: StatsMap,
  opts: DeckOptions,
  rng: Rng,
): Question[] {
  const pool = shuffle(selectPool(questions, stats, opts), rng);
  // Array.prototype.sort is stable (ES2019+).
  pool.sort((a, b) => priority(a, stats) - priority(b, stats));
  const taken = opts.length === "all" ? pool : pool.slice(0, opts.length);
  return shuffle(taken, rng);
}
