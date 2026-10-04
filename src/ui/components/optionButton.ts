import { h, srOnly } from "../dom";
import { strings } from "../strings.nb";

export type OptionMark = "none" | "correct" | "chosen-wrong" | "dimmed";

export function optionButton(
  index: number,
  label: string,
  mark: OptionMark,
  locked: boolean,
  onSelect: (index: number) => void,
): HTMLButtonElement {
  const icon = mark === "correct" ? "✓" : mark === "chosen-wrong" ? "✗" : String(index + 1);
  return h(
    "button",
    {
      type: "button",
      class: ["option", `option--${mark}`],
      disabled: locked,
      "aria-keyshortcuts": index < 9 ? String(index + 1) : undefined,
      dataset: { index: String(index) },
      onclick: () => onSelect(index),
    },
    h("span", { class: "option__key", "aria-hidden": "true" }, icon),
    h("span", { class: "option__label" }, label),
    mark === "correct" ? srOnly(` (${strings.rightAnswer})`) : null,
    mark === "chosen-wrong" ? srOnly(` (${strings.yourAnswer})`) : null,
  );
}
