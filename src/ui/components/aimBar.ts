import { isLow, type AimResult } from "../../domain/results";
import { h } from "../dom";
import { strings } from "../strings.nb";

export function aimBar(result: AimResult, label: string): HTMLElement {
  const low = isLow(result);
  const pct = result.attempted ? Math.round((result.correct / result.attempted) * 100) : 0;
  return h(
    "li",
    { class: ["aim-bar", low && "aim-bar--low"] },
    h(
      "div",
      { class: "aim-bar__head" },
      h("span", { class: "aim-bar__label" }, label),
      h(
        "span",
        { class: "aim-bar__score" },
        low ? h("span", { class: "aim-bar__flag" }, strings.focusHere) : null,
        strings.aimScore(result.correct, result.attempted),
      ),
    ),
    h(
      "div",
      { class: "aim-bar__track", "aria-hidden": "true" },
      h("div", { class: "aim-bar__fill", style: { width: `${pct}%` } }),
    ),
  );
}
