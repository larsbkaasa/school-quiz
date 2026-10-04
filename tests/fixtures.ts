import type { Pack, Question, SingleQuestion, TfQuestion } from "../src/domain/types";

const source = { name: "Test", url: "https://example.org/", checked: "2026-10-01" };

export function single(id: string, aim: string, overrides: Partial<SingleQuestion> = {}): SingleQuestion {
  return {
    id,
    aim,
    type: "single",
    difficulty: 1,
    q: `Spørsmål ${id}?`,
    options: ["Riktig", "Feil A", "Feil B"],
    answer: 0,
    explain: `Forklaring ${id}.`,
    imageRequired: false,
    source,
    status: "approved",
    ...overrides,
  };
}

export function tf(
  id: string,
  aim: string,
  answer: boolean,
  overrides: Partial<TfQuestion> = {},
): TfQuestion {
  return {
    id,
    aim,
    type: "tf",
    difficulty: 1,
    q: `Påstand ${id}.`,
    answer,
    explain: `Forklaring ${id}.`,
    imageRequired: false,
    source,
    status: "approved",
    ...overrides,
  };
}

export function pack(questions: Question[], aims = ["a-1", "a-2"]): Pack {
  return {
    schemaVersion: 1,
    code: "TST01-01",
    name: "Testfag",
    language: "nb-NO",
    curriculumUrl: "https://example.org/",
    aims: aims.map((id) => ({ id, short: `Mål ${id}`, full: `Kompetansemål ${id}` })),
    questions,
  };
}
