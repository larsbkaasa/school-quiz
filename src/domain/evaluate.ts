import { shuffle, type Rng } from "./random";
import type { Question } from "./types";

/** The value an option stands for: an original option index (`single`) or a boolean (`tf`). */
export type AnswerValue = number | boolean;

export interface PresentedOption {
  label: string;
  value: AnswerValue;
}

/** One presentation of a question, with its option order fixed for that presentation. */
export interface PresentedQuestion {
  /** Unique per presentation (a re-queued question gets a new key). */
  key: string;
  question: Question;
  options: PresentedOption[];
}

export interface TfLabels {
  true: string;
  false: string;
}

let presentationCounter = 0;

/**
 * Builds a presentation. `single` options are shuffled; `tf` keeps a fixed order (Sant, Usant).
 */
export function present(question: Question, rng: Rng, tfLabels: TfLabels): PresentedQuestion {
  const key = `${question.id}#${++presentationCounter}`;
  if (question.type === "tf") {
    return {
      key,
      question,
      options: [
        { label: tfLabels.true, value: true },
        { label: tfLabels.false, value: false },
      ],
    };
  }
  const options = question.options.map((label, value) => ({ label, value }));
  return { key, question, options: shuffle(options, rng) };
}

export function isCorrect(question: Question, value: AnswerValue): boolean {
  return question.answer === value;
}

/** Index (in presented order) of the correct option. */
export function correctOptionIndex(presented: PresentedQuestion): number {
  return presented.options.findIndex((o) => isCorrect(presented.question, o.value));
}
