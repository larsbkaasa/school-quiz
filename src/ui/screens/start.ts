import { countByAim } from "../../domain/content";
import { missedCount, selectPool, type SessionLength } from "../../domain/deck";
import type { AppContext, StartSettings } from "../app";
import { h, render } from "../dom";
import { strings } from "../strings.nb";

const LENGTHS: SessionLength[] = [10, 20, "all"];

export function renderStart(
  root: HTMLElement,
  ctx: AppContext,
  settings: StartSettings,
  onStart: (settings: StartSettings) => void,
): void {
  const { pack } = ctx;
  const counts = countByAim(pack);
  const stats = ctx.store.get(pack.code);

  const status = h("p", { class: "start__status", id: "start-status", "aria-live": "polite" });
  const startBtn = h(
    "button",
    { type: "submit", class: "btn btn--primary", "aria-describedby": "start-status" },
    strings.start,
  );
  const missedInput = h("input", { type: "checkbox", id: "only-missed", name: "onlyMissed" });
  const missedHint = h("span", { class: "field__hint" });

  const aimInputs = pack.aims.map((aim) =>
    h("input", {
      type: "checkbox",
      name: "aim",
      value: aim.id,
      id: `aim-${aim.id}`,
      checked: settings.aims.has(aim.id),
    }),
  );

  const update = () => {
    settings.aims = new Set(aimInputs.filter((i) => i.checked).map((i) => i.value));
    const missed = missedCount(pack.questions, stats, settings.aims);
    missedInput.disabled = missed === 0;
    if (missed === 0) missedInput.checked = false;
    settings.onlyMissed = missedInput.checked;
    missedHint.textContent = strings.onlyMissedCount(missed);

    const pool = selectPool(pack.questions, stats, settings);
    let message = "";
    if (settings.aims.size === 0) message = strings.startDisabledNoAims;
    else if (pool.length === 0) message = strings.startDisabledEmpty;
    status.textContent = message;
    startBtn.disabled = message !== "";
  };

  missedInput.addEventListener("change", update);

  const setAll = (checked: boolean) => {
    aimInputs.forEach((i) => (i.checked = checked));
    update();
  };

  const aimRows = pack.aims.map((aim, i) =>
    h(
      "li",
      { class: "check" },
      aimInputs[i],
      h(
        "label",
        { for: `aim-${aim.id}` },
        h("span", { class: "check__title" }, aim.short),
        h("span", { class: "check__meta" }, strings.questionCount(counts.get(aim.id) ?? 0)),
      ),
    ),
  );

  const lengthRows = LENGTHS.map((len) => {
    const id = `len-${len}`;
    return h(
      "span",
      { class: "segmented__item" },
      h("input", {
        type: "radio",
        name: "length",
        id,
        value: String(len),
        checked: settings.length === len,
        onchange: () => (settings.length = len),
      }),
      h("label", { for: id }, len === "all" ? strings.lengthAll : String(len)),
    );
  });

  const subjectField =
    ctx.subjects.length > 1
      ? h("p", { class: "start__subject" }, `${strings.subject}: ${ctx.subject.name}`)
      : h("p", { class: "start__subject" }, `${pack.name} · ${ctx.subject.grades}. trinn`);

  const form = h(
    "form",
    {
      class: "start",
      onsubmit: (e: SubmitEvent) => {
        e.preventDefault();
        update();
        if (!startBtn.disabled) onStart({ ...settings, aims: new Set(settings.aims) });
      },
    },
    h(
      "fieldset",
      { class: "field" },
      h("legend", null, strings.aimsLegend),
      h("p", { class: "field__hint" }, strings.aimsHint),
      h(
        "div",
        { class: "field__actions" },
        h(
          "button",
          { type: "button", class: "btn btn--link", onclick: () => setAll(true) },
          strings.selectAll,
        ),
        h(
          "button",
          { type: "button", class: "btn btn--link", onclick: () => setAll(false) },
          strings.selectNone,
        ),
      ),
      h("ul", { class: "checks", onchange: update }, aimRows),
    ),
    h(
      "fieldset",
      { class: "field" },
      h("legend", null, strings.lengthLegend),
      h("div", { class: "segmented" }, lengthRows),
    ),
    h(
      "div",
      { class: "field check check--solo" },
      missedInput,
      h(
        "label",
        { for: "only-missed" },
        h("span", { class: "check__title" }, strings.onlyMissed),
        missedHint,
      ),
    ),
    h("div", { class: "start__actions" }, startBtn, status),
  );

  render(
    root,
    h(
      "section",
      { class: "screen screen--start" },
      h(
        "header",
        { class: "hero" },
        h("h1", { tabindex: "-1", "data-screen-heading": true }, strings.appName),
        h("p", { class: "hero__tagline" }, strings.tagline),
        subjectField,
      ),
      ctx.dev ? h("p", { class: "dev-banner" }, strings.devBanner) : null,
      form,
      h("p", { class: "privacy" }, strings.privacy),
    ),
  );
  update();
}
