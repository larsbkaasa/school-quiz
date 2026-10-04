import type { PresentedQuestion } from "../../domain/evaluate";
import type { AnswerResult } from "../../domain/session";
import type { Aim } from "../../domain/types";
import { h } from "../dom";
import { optionButton, type OptionMark } from "./optionButton";
import { questionImage } from "./questionImage";

export interface QuestionCardProps {
  presented: PresentedQuestion;
  aim: Aim | undefined;
  result: AnswerResult | null;
  onSelect: (index: number) => void;
  onImageError: () => void;
  /** Reuse the existing <figure> across re-renders so the image doesn't flicker or reload. */
  figure?: HTMLElement | null;
}

function markFor(i: number, result: AnswerResult | null): OptionMark {
  if (!result) return "none";
  if (i === result.correctIndex) return "correct";
  if (i === result.chosenIndex) return "chosen-wrong";
  return "dimmed";
}

/** The "enamel bowl" card: aim tag, optional image, question text, options. */
export function questionCard(props: QuestionCardProps): { card: HTMLElement; figure: HTMLElement | null } {
  const { presented, aim, result } = props;
  const q = presented.question;
  const figure = q.image ? (props.figure ?? questionImage(q.image, props.onImageError)) : null;
  const card = h(
    "article",
    { class: "card", "aria-labelledby": "question-text" },
    aim ? h("p", { class: "card__aim", title: aim.full }, aim.short) : null,
    figure,
    h(
      "h2",
      { id: "question-text", class: "card__question", tabindex: "-1", "data-screen-heading": true },
      q.q,
    ),
    h(
      "div",
      { class: "options", role: "group", "aria-labelledby": "question-text" },
      presented.options.map((o, i) =>
        optionButton(i, o.label, markFor(i, result), result !== null, props.onSelect),
      ),
    ),
  );
  return { card, figure };
}
