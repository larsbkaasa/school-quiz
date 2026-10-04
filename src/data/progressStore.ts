import type { QuestionStats, StatsMap } from "../domain/types";

export interface ProgressStore {
  get(subject: string): StatsMap;
  update(subject: string, id: string, fn: (s?: QuestionStats) => QuestionStats): void;
  reset(subject: string): void;
}

export const storageKey = (subject: string) => `skolequiz:v1:${subject}:stats`;

function isStats(v: unknown): v is QuestionStats {
  if (typeof v !== "object" || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.seen === "number" &&
    typeof s.correct === "number" &&
    typeof s.lastWrong === "boolean" &&
    typeof s.lastSeen === "string"
  );
}

function sanitize(raw: unknown): StatsMap {
  const out: StatsMap = {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return out;
  for (const [id, v] of Object.entries(raw)) if (isStats(v)) out[id] = v;
  return out;
}

export class MemoryProgressStore implements ProgressStore {
  private data = new Map<string, StatsMap>();

  get(subject: string): StatsMap {
    return { ...this.data.get(subject) };
  }

  update(subject: string, id: string, fn: (s?: QuestionStats) => QuestionStats): void {
    const map = this.get(subject);
    map[id] = fn(map[id]);
    this.data.set(subject, map);
  }

  reset(subject: string): void {
    this.data.delete(subject);
  }
}

/**
 * localStorage-backed store. Any storage failure (private mode, quota, disabled storage)
 * silently switches to an in-memory store for the rest of the page's life (§6.7).
 */
export class LocalProgressStore implements ProgressStore {
  private fallback: MemoryProgressStore | null = null;

  constructor(private readonly storage: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null) {
    if (!storage) this.fallback = new MemoryProgressStore();
  }

  get(subject: string): StatsMap {
    if (this.fallback) return this.fallback.get(subject);
    try {
      const raw = this.storage!.getItem(storageKey(subject));
      return raw ? sanitize(JSON.parse(raw)) : {};
    } catch {
      return {};
    }
  }

  update(subject: string, id: string, fn: (s?: QuestionStats) => QuestionStats): void {
    if (this.fallback) return this.fallback.update(subject, id, fn);
    const map = this.get(subject);
    map[id] = fn(map[id]);
    try {
      this.storage!.setItem(storageKey(subject), JSON.stringify(map));
    } catch {
      this.switchToMemory(subject, map);
    }
  }

  reset(subject: string): void {
    if (this.fallback) return this.fallback.reset(subject);
    try {
      this.storage!.removeItem(storageKey(subject));
    } catch {
      this.switchToMemory(subject, {});
    }
  }

  private switchToMemory(subject: string, map: StatsMap): void {
    const mem = new MemoryProgressStore();
    for (const [id, s] of Object.entries(map)) mem.update(subject, id, () => s);
    this.fallback = mem;
  }
}

export function createProgressStore(): ProgressStore {
  try {
    return new LocalProgressStore(window.localStorage);
  } catch {
    return new LocalProgressStore(null);
  }
}
