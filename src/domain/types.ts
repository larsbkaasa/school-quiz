import type { z } from "zod";
import type {
  AimSchema,
  ImageSchema,
  PackSchema,
  QuestionSchema,
  SingleQuestionSchema,
  SubjectIndexSchema,
  TfQuestionSchema,
} from "./schema";

export type Pack = z.infer<typeof PackSchema>;
export type Aim = z.infer<typeof AimSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type SingleQuestion = z.infer<typeof SingleQuestionSchema>;
export type TfQuestion = z.infer<typeof TfQuestionSchema>;
export type QuestionImage = z.infer<typeof ImageSchema>;
export type SubjectIndex = z.infer<typeof SubjectIndexSchema>;
export type Subject = SubjectIndex["subjects"][number];

/** Per-question local progress (§6.7). */
export interface QuestionStats {
  seen: number;
  correct: number;
  lastWrong: boolean;
  /** ISO date (YYYY-MM-DD). */
  lastSeen: string;
}

export type StatsMap = Record<string, QuestionStats>;
