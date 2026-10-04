import { correctOptionIndex, isCorrect, type PresentedQuestion } from "./evaluate";
import type { Question, QuestionStats } from "./types";

/** How many positions after the current one a missed question is re-inserted (§3.2). */
export const REQUEUE_OFFSET = 4;

export interface SessionState {
  readonly queue: readonly PresentedQuestion[];
  readonly index: number;
  /** question id → correct on first attempt. Results count only these (§3.4). */
  readonly firstAttempt: ReadonlyMap<string, boolean>;
  /** Question ids already re-queued once in this session. */
  readonly requeued: ReadonlySet<string>;
  /** Presentation key → whether that presentation was answered correctly. */
  readonly outcomes: ReadonlyMap<string, boolean>;
  /** Option index chosen for the current presentation, or null while unanswered. */
  readonly chosen: number | null;
}

export interface AnswerResult {
  correct: boolean;
  chosenIndex: number;
  correctIndex: number;
  correctLabel: string;
  explain: string;
  requeued: boolean;
}

export interface StatsUpdate {
  id: string;
  correct: boolean;
  firstAttempt: boolean;
}

export type Presenter = (question: Question) => PresentedQuestion;

export function createSession(deck: readonly Question[], presentQuestion: Presenter): SessionState {
  return {
    queue: deck.map(presentQuestion),
    index: 0,
    firstAttempt: new Map(),
    requeued: new Set(),
    outcomes: new Map(),
    chosen: null,
  };
}

export function current(state: SessionState): PresentedQuestion | undefined {
  return state.queue[state.index];
}

export function isAnswered(state: SessionState): boolean {
  return state.chosen !== null;
}

export function answer(
  state: SessionState,
  optionIndex: number,
  presentQuestion: Presenter,
): { state: SessionState; result: AnswerResult; statsUpdate?: StatsUpdate } {
  const presented = current(state);
  if (!presented) throw new Error("Session is finished");
  if (state.chosen !== null) throw new Error("Question already answered");
  const option = presented.options[optionIndex];
  if (!option) throw new Error(`No option at index ${optionIndex}`);

  const q = presented.question;
  const correct = isCorrect(q, option.value);
  const isFirst = !state.firstAttempt.has(q.id);

  let firstAttempt = state.firstAttempt;
  let statsUpdate: StatsUpdate | undefined;
  if (isFirst) {
    firstAttempt = new Map(state.firstAttempt).set(q.id, correct);
    statsUpdate = { id: q.id, correct, firstAttempt: true };
  } else if (correct) {
    // Correct on a retry clears lastWrong, but does not change the score.
    statsUpdate = { id: q.id, correct: true, firstAttempt: false };
  }

  let queue = state.queue;
  let requeued = state.requeued;
  const willRequeue = !correct && !state.requeued.has(q.id);
  if (willRequeue) {
    const at = Math.min(state.index + REQUEUE_OFFSET, state.queue.length);
    const copy = state.queue.slice();
    copy.splice(at, 0, presentQuestion(q));
    queue = copy;
    requeued = new Set(state.requeued).add(q.id);
  }

  const correctIndex = correctOptionIndex(presented);
  return {
    state: {
      queue,
      index: state.index,
      firstAttempt,
      requeued,
      outcomes: new Map(state.outcomes).set(presented.key, correct),
      chosen: optionIndex,
    },
    result: {
      correct,
      chosenIndex: optionIndex,
      correctIndex,
      correctLabel: presented.options[correctIndex]?.label ?? "",
      explain: q.explain,
      requeued: willRequeue,
    },
    ...(statsUpdate ? { statsUpdate } : {}),
  };
}

export function next(state: SessionState): { state: SessionState; finished: boolean } {
  const index = state.index + 1;
  return { state: { ...state, index, chosen: null }, finished: index >= state.queue.length };
}

/**
 * Removes the current presentation without scoring it (e.g. a required image failed to load).
 * Later re-queued presentations of the same question are removed too.
 */
export function skipCurrent(state: SessionState): { state: SessionState; finished: boolean } {
  const presented = current(state);
  if (!presented) return { state, finished: true };
  const id = presented.question.id;
  const queue = state.queue.filter((p, i) => i < state.index || p.question.id !== id);
  const firstAttempt = new Map(state.firstAttempt);
  firstAttempt.delete(id);
  const next = { ...state, queue, firstAttempt, chosen: null };
  return { state: next, finished: state.index >= queue.length };
}

export function isFinished(state: SessionState): boolean {
  return state.index >= state.queue.length;
}

/** Applies a stats update to the stored stats for one question (§6.7, §7.2). */
export function applyStatsUpdate(
  prev: QuestionStats | undefined,
  update: StatsUpdate,
  today: string,
): QuestionStats {
  const base: QuestionStats = prev ?? { seen: 0, correct: 0, lastWrong: false, lastSeen: today };
  if (!update.firstAttempt) return { ...base, lastWrong: false, lastSeen: today };
  return {
    seen: base.seen + 1,
    correct: base.correct + (update.correct ? 1 : 0),
    lastWrong: !update.correct,
    lastSeen: today,
  };
}

/** Local calendar date as YYYY-MM-DD. */
export function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
