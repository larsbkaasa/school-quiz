import { computeResults } from "../../domain/results";
import type { SessionState } from "../../domain/session";
import type { AppContext } from "../app";
import { aimBar } from "../components/aimBar";
import { h, render } from "../dom";
import { strings } from "../strings.nb";

export interface ResultHandlers {
  onPracticeMissed: (ids: string[]) => void;
  onNewRound: () => void;
}

export function renderResult(
  root: HTMLElement,
  ctx: AppContext,
  state: SessionState,
  handlers: ResultHandlers,
): void {
  const r = computeResults(state, ctx.pack.aims);
  const aims = new Map(ctx.pack.aims.map((a) => [a.id, a]));
  const share = r.total ? r.correct / r.total : 0;
  const encouragement =
    share >= 0.8
      ? strings.scoreEncouragementHigh
      : share >= 0.5
        ? strings.scoreEncouragementMid
        : strings.scoreEncouragementLow;

  render(
    root,
    h(
      "section",
      { class: "screen screen--result" },
      h("h1", { tabindex: "-1", "data-screen-heading": true }, strings.resultsTitle),
      r.total === 0
        ? h("p", { class: "score" }, strings.noAnswers)
        : [
            h(
              "div",
              { class: "card card--score" },
              h("p", { class: "score__big", "aria-hidden": "true" }, `${r.correct}/${r.total}`),
              h("p", { class: "score" }, strings.score(r.correct, r.total)),
              h("p", { class: "score__encouragement" }, encouragement),
            ),
            h("h2", null, strings.perAimTitle),
            h(
              "ul",
              { class: "aim-bars" },
              r.perAim.map((a) => aimBar(a, aims.get(a.aimId)?.short ?? a.aimId)),
            ),
          ],
      h(
        "div",
        { class: "result__actions" },
        r.wrongIds.length
          ? h(
              "button",
              {
                type: "button",
                class: "btn btn--primary",
                onclick: () => handlers.onPracticeMissed(r.wrongIds),
              },
              strings.practiceMissed,
            )
          : null,
        h(
          "button",
          {
            type: "button",
            class: r.wrongIds.length ? "btn btn--secondary" : "btn btn--primary",
            onclick: handlers.onNewRound,
          },
          strings.newRound,
        ),
      ),
    ),
  );
}
