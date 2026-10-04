import type { Question } from "../../domain/types";
import { present } from "../../domain/evaluate";
import {
  answer,
  applyStatsUpdate,
  createSession,
  current,
  next,
  skipCurrent,
  type AnswerResult,
  type Presenter,
  type SessionState,
} from "../../domain/session";
import type { AppContext } from "../app";
import { focusHeading } from "../app";
import { progressDots } from "../components/progressDots";
import { questionCard } from "../components/questionCard";
import { preloadImage } from "../components/questionImage";
import { h, render, type Child } from "../dom";
import { strings } from "../strings.nb";

export interface QuizHandlers {
  onQuit: () => void;
  onFinish: (state: SessionState) => void;
}

/** Renders a quiz session. Returns a cleanup function. */
export function renderQuiz(
  root: HTMLElement,
  ctx: AppContext,
  deck: readonly Question[],
  handlers: QuizHandlers,
): () => void {
  const presenter: Presenter = (q) =>
    present(q, ctx.rng, { true: strings.trueLabel, false: strings.falseLabel });
  const aims = new Map(ctx.pack.aims.map((a) => [a.id, a]));

  let state = createSession(deck, presenter);
  let result: AnswerResult | null = null;
  let figure: HTMLElement | null = null;
  let done = false;

  const finish = () => {
    if (done) return;
    done = true;
    cleanup();
    handlers.onFinish(state);
  };

  const quit = () => {
    done = true;
    cleanup();
    handlers.onQuit();
  };

  const select = (index: number) => {
    if (result || done) return;
    const out = answer(state, index, presenter);
    state = out.state;
    result = out.result;
    if (out.statsUpdate) {
      const update = out.statsUpdate;
      const today = ctx.today();
      ctx.store.update(ctx.pack.code, update.id, (prev) => applyStatsUpdate(prev, update, today));
    }
    preloadImage(state.queue[state.index + 1]?.question.image);
    draw({ focus: "next" });
  };

  const advance = () => {
    if (!result || done) return;
    const out = next(state);
    state = out.state;
    result = null;
    figure = null;
    if (out.finished) return finish();
    draw({ focus: "question" });
  };

  const onImageError = (questionId: string) => {
    const presented = current(state);
    if (done || !presented || presented.question.id !== questionId) return;
    if (!presented.question.imageRequired || result) return;
    console.warn(`[skolequiz] Skipping ${questionId}: required image failed to load.`);
    const out = skipCurrent(state);
    state = out.state;
    figure = null;
    if (out.finished) return finish();
    draw({ focus: "question" });
  };

  const onKey = (e: KeyboardEvent) => {
    if (done || e.altKey || e.ctrlKey || e.metaKey) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("input, textarea, select")) return;
    if (/^[1-9]$/.test(e.key) && !result) {
      const index = Number(e.key) - 1;
      if (index < (current(state)?.options.length ?? 0)) {
        e.preventDefault();
        select(index);
      }
    } else if (e.key === "Enter" && result && !(target instanceof HTMLButtonElement)) {
      // Buttons handle Enter natively; avoid a double advance.
      e.preventDefault();
      advance();
    }
  };
  document.addEventListener("keydown", onKey);

  function cleanup() {
    document.removeEventListener("keydown", onKey);
  }

  function draw(opts: { focus: "question" | "next" }) {
    const presented = current(state);
    if (!presented) return finish();
    const isLast = state.index === state.queue.length - 1;
    const questionId = presented.question.id;

    const { card, figure: fig } = questionCard({
      presented,
      aim: aims.get(presented.question.aim),
      result,
      onSelect: select,
      onImageError: () => onImageError(questionId),
      figure,
    });
    figure = fig;

    const nextBtn = result
      ? h(
          "button",
          { type: "button", class: "btn btn--primary", onclick: advance },
          isLast ? strings.seeResults : strings.next,
        )
      : null;

    render(
      root,
      h(
        "section",
        { class: "screen screen--quiz" },
        h(
          "header",
          { class: "quiz__bar" },
          progressDots(state),
          h(
            "button",
            {
              type: "button",
              class: "btn btn--ghost",
              onclick: quit,
            },
            strings.quit,
          ),
        ),
        card,
        h(
          "div",
          {
            class: ["feedback", result && (result.correct ? "feedback--ok" : "feedback--bad")],
            "aria-live": "polite",
          },
          result ? feedback(result) : null,
        ),
        h("div", { class: "quiz__actions" }, nextBtn),
        result ? null : h("p", { class: "hint" }, strings.keyboardHint),
      ),
    );

    if (opts.focus === "next" && nextBtn) nextBtn.focus();
    else focusHeading(root);
  }

  draw({ focus: "question" });
  return cleanup;
}

function feedback(result: AnswerResult): Child[] {
  return [
    h(
      "p",
      { class: "feedback__title" },
      h("span", { class: "feedback__icon", "aria-hidden": "true" }, result.correct ? "✓" : "✗"),
      result.correct
        ? strings.correct
        : `${strings.notQuite} ${strings.correctAnswerIs(result.correctLabel)}`,
    ),
    h("p", { class: "feedback__explain" }, result.explain),
    result.requeued ? h("p", { class: "feedback__note" }, strings.requeuedNote) : null,
  ];
}
