import { filterByStatus } from "../domain/content";
import { PackSchema, SubjectIndexSchema } from "../domain/schema";
import type { Pack, Subject, SubjectIndex } from "../domain/types";

export const CONTENT_BASE = `${import.meta.env.BASE_URL}content/`;

export class ContentError extends Error {}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { cache: "no-cache" });
  if (!res.ok) throw new ContentError(`${url}: HTTP ${res.status}`);
  return res.json();
}

export async function loadSubjects(): Promise<SubjectIndex> {
  const parsed = SubjectIndexSchema.safeParse(await fetchJson(`${CONTENT_BASE}subjects.json`));
  if (!parsed.success) throw new ContentError(`subjects.json: ${parsed.error.message}`);
  return parsed.data;
}

export async function loadPack(subject: Subject, includeUnapproved = import.meta.env.DEV): Promise<Pack> {
  const parsed = PackSchema.safeParse(await fetchJson(`${CONTENT_BASE}${subject.file}`));
  if (!parsed.success) throw new ContentError(`${subject.file}: ${parsed.error.message}`);
  return filterByStatus(parsed.data, includeUnapproved);
}

export function imageUrl(src: string): string {
  return `${CONTENT_BASE}images/${src}`;
}
