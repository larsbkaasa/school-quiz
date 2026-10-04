import type { SessionState } from "./session";
import type { Aim } from "./types";

export interface AimResult {
  aimId: string;
  attempted: number;
  correct: number;
}

export interface SessionResult {
  total: number;
  correct: number;
  /** In pack aim order; only aims with at least one attempted question. */
  perAim: AimResult[];
  wrongIds: string[];
}

/** Results are computed from first attempts only (§7.3). */
export function computeResults(state: SessionState, aims: readonly Aim[]): SessionResult {
  const aimOf = new Map<string, string>();
  for (const p of state.queue) aimOf.set(p.question.id, p.question.aim);

  const perAimMap = new Map<string, AimResult>();
  let correct = 0;
  const wrongIds: string[] = [];
  for (const [id, ok] of state.firstAttempt) {
    const aimId = aimOf.get(id);
    if (!aimId) continue;
    const r = perAimMap.get(aimId) ?? { aimId, attempted: 0, correct: 0 };
    r.attempted++;
    if (ok) {
      r.correct++;
      correct++;
    } else {
      wrongIds.push(id);
    }
    perAimMap.set(aimId, r);
  }

  const perAim = aims.map((a) => perAimMap.get(a.id)).filter((r): r is AimResult => !!r);
  return { total: state.firstAttempt.size, correct, perAim, wrongIds };
}

/** Bars under this share are highlighted (§4). */
export const LOW_SCORE_THRESHOLD = 0.5;

export function isLow(r: AimResult): boolean {
  return r.attempted > 0 && r.correct / r.attempted < LOW_SCORE_THRESHOLD;
}
