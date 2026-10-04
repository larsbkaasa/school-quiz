import type { SessionState } from "../../domain/session";
import { h } from "../dom";
import { strings } from "../strings.nb";

/** One dot per queued presentation; the queue grows when questions are re-queued. */
export function progressDots(state: SessionState): HTMLElement {
  const total = state.queue.length;
  const dots = state.queue.map((p, i) => {
    const outcome = state.outcomes.get(p.key);
    const status =
      outcome === true ? "ok" : outcome === false ? "bad" : i === state.index ? "current" : "pending";
    return h("li", { class: ["dot", `dot--${status}`] });
  });
  return h(
    "div",
    { class: "progress" },
    h("p", { class: "progress__label" }, strings.progress(Math.min(state.index + 1, total), total)),
    h("ol", { class: "progress__dots", "aria-hidden": "true" }, dots),
  );
}
