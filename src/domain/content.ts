import type { Pack } from "./types";

/** Production ships only approved questions; dev builds show draft and review too (§6.5). */
export function filterByStatus(pack: Pack, includeUnapproved: boolean): Pack {
  if (includeUnapproved) return pack;
  return { ...pack, questions: pack.questions.filter((q) => q.status === "approved") };
}

export function countByAim(pack: Pack): Map<string, number> {
  const counts = new Map<string, number>(pack.aims.map((a) => [a.id, 0]));
  for (const q of pack.questions) counts.set(q.aim, (counts.get(q.aim) ?? 0) + 1);
  return counts;
}
