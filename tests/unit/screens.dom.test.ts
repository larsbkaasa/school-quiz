// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryProgressStore } from "../../src/data/progressStore";
import { seededRng } from "../../src/domain/random";
import { answer, createSession, next, type SessionState } from "../../src/domain/session";
import { present } from "../../src/domain/evaluate";
import type { Question } from "../../src/domain/types";
import type { AppContext, StartSettings } from "../../src/ui/app";
import { renderQuiz } from "../../src/ui/screens/quiz";
import { renderResult } from "../../src/ui/screens/result";
import { renderStart } from "../../src/ui/screens/start";
import { pack, single, tf } from "../fixtures";

const image = {
  src: "tst01-01/bilde.svg",
  alt: "Et testbilde",
  width: 10,
  height: 10,
  credit: "Test",
  license: "CC0",
};

function makeCtx(questions: Question[]): AppContext {
  const p = pack(questions);
  return {
    subjects: [{ code: p.code, name: p.name, file: "tst01-01.json", grades: "8–10" }],
    subject: { code: p.code, name: p.name, file: "tst01-01.json", grades: "8–10" },
    pack: p,
    store: new MemoryProgressStore(),
    rng: seededRng(1),
    today: () => "2026-10-04",
    dev: false,
  };
}

let root: HTMLElement;
beforeEach(() => {
  document.body.replaceChildren();
  root = document.createElement("main");
  document.body.append(root);
});
afterEach(() => vi.restoreAllMocks());

const options = () => [...root.querySelectorAll<HTMLButtonElement>("button.option")];
const optionByLabel = (label: string) =>
  options().find((b) => b.querySelector(".option__label")?.textContent === label)!;
const heading = () => root.querySelector("#question-text")?.textContent;
const nextButton = () =>
  [...root.querySelectorAll<HTMLButtonElement>("button")].find((b) =>
    /Neste spørsmål|Se resultatet/.test(b.textContent ?? ""),
  );
const key = (k: string, target: EventTarget = document.body) =>
  target.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

describe("quiz screen", () => {
  it("locks options and shows feedback after an answer", () => {
    const ctx = makeCtx([tf("t-0001", "a-1", false)]);
    renderQuiz(root, ctx, ctx.pack.questions, { onQuit: vi.fn(), onFinish: vi.fn() });
    expect(options().map((b) => b.textContent)).toEqual(["1Sant", "2Usant"]);
    expect(options().every((b) => !b.disabled)).toBe(true);

    optionByLabel("Sant").click();

    expect(options().every((b) => b.disabled)).toBe(true);
    expect(optionByLabel("Sant").classList).toContain("option--chosen-wrong");
    expect(optionByLabel("Usant").classList).toContain("option--correct");
    // Not by colour alone: icons and screen-reader text.
    expect(optionByLabel("Usant").textContent).toContain("✓");
    expect(optionByLabel("Usant").textContent).toContain("(riktig svar)");
    const feedback = root.querySelector("[aria-live]")!;
    expect(feedback.textContent).toContain("Ikke helt. Riktig svar: Usant");
    expect(feedback.textContent).toContain("Forklaring t-0001.");
    expect(feedback.textContent).toContain("Du får dette spørsmålet igjen");
    expect(document.activeElement).toBe(nextButton());
  });

  it("writes first-attempt stats to the store", () => {
    const ctx = makeCtx([tf("t-0001", "a-1", true)]);
    renderQuiz(root, ctx, ctx.pack.questions, { onQuit: vi.fn(), onFinish: vi.fn() });
    optionByLabel("Usant").click();
    expect(ctx.store.get(ctx.pack.code)).toEqual({
      "t-0001": { seen: 1, correct: 0, lastWrong: true, lastSeen: "2026-10-04" },
    });
  });

  it("supports keyboard: digits answer, Enter advances, finishing calls onFinish", () => {
    const ctx = makeCtx([tf("t-0001", "a-1", true), tf("t-0002", "a-1", true)]);
    const onFinish = vi.fn();
    renderQuiz(root, ctx, ctx.pack.questions, { onQuit: vi.fn(), onFinish });
    const first = heading();
    key("9"); // out of range: ignored
    expect(nextButton()).toBeUndefined();
    key("1");
    expect(nextButton()?.textContent).toBe("Neste spørsmål");
    key("1"); // already answered: ignored
    key("Enter");
    expect(heading()).not.toBe(first);
    key("1");
    expect(nextButton()?.textContent).toBe("Se resultatet");
    key("Enter");
    expect(onFinish).toHaveBeenCalledTimes(1);
    const state = onFinish.mock.calls[0]![0] as SessionState;
    expect([...state.firstAttempt.values()]).toEqual([true, true]);
  });

  it("Enter on a focused button is left to the button (no double advance)", () => {
    const ctx = makeCtx([tf("t-0001", "a-1", true), tf("t-0002", "a-1", true), tf("t-0003", "a-1", true)]);
    renderQuiz(root, ctx, ctx.pack.questions, { onQuit: vi.fn(), onFinish: vi.fn() });
    key("1");
    const before = heading();
    key("Enter", nextButton()!);
    expect(heading()).toBe(before);
  });

  it("re-queued questions grow the progress indicator", () => {
    const ctx = makeCtx([tf("t-0001", "a-1", true), tf("t-0002", "a-1", true)]);
    renderQuiz(root, ctx, ctx.pack.questions, { onQuit: vi.fn(), onFinish: vi.fn() });
    expect(root.querySelector(".progress__label")?.textContent).toBe("Spørsmål 1 av 2");
    optionByLabel("Usant").click();
    expect(root.querySelector(".progress__label")?.textContent).toBe("Spørsmål 1 av 3");
    expect(root.querySelectorAll(".dot")).toHaveLength(3);
    expect(root.querySelector(".dot--bad")).not.toBeNull();
  });

  it("hides a broken optional image and keeps the question", () => {
    const ctx = makeCtx([single("t-0001", "a-1", { image })]);
    renderQuiz(root, ctx, ctx.pack.questions, { onQuit: vi.fn(), onFinish: vi.fn() });
    const img = root.querySelector("img")!;
    expect(img.getAttribute("alt")).toBe("Et testbilde");
    expect(img.getAttribute("width")).toBe("10");
    expect(img.getAttribute("loading")).toBeNull();
    img.dispatchEvent(new Event("error"));
    expect(root.querySelector("figure")!.hidden).toBe(true);
    expect(heading()).toBe("Spørsmål t-0001?");
  });

  it("skips a question whose required image fails to load", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ctx = makeCtx([single("t-0001", "a-1", { image, imageRequired: true }), single("t-0002", "a-1")]);
    renderQuiz(root, ctx, ctx.pack.questions, { onQuit: vi.fn(), onFinish: vi.fn() });
    expect(heading()).toBe("Spørsmål t-0001?");
    root.querySelector("img")!.dispatchEvent(new Event("error"));
    expect(heading()).toBe("Spørsmål t-0002?");
    expect(root.querySelector(".progress__label")?.textContent).toBe("Spørsmål 1 av 1");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("t-0001"));
  });

  it("Avslutt calls onQuit and detaches keyboard handling", () => {
    const ctx = makeCtx([tf("t-0001", "a-1", true)]);
    const onQuit = vi.fn();
    renderQuiz(root, ctx, ctx.pack.questions, { onQuit, onFinish: vi.fn() });
    [...root.querySelectorAll("button")].find((b) => b.textContent === "Avslutt")!.click();
    expect(onQuit).toHaveBeenCalled();
    root.replaceChildren();
    key("1");
    expect(ctx.store.get(ctx.pack.code)).toEqual({});
  });
});

describe("start screen", () => {
  const settings = (): StartSettings => ({ aims: new Set(["a-1", "a-2"]), length: 10, onlyMissed: false });

  it("shows question counts per aim and blocks start with no aims", () => {
    const ctx = makeCtx([single("t-0001", "a-1"), single("t-0002", "a-1"), single("t-0003", "a-2")]);
    const onStart = vi.fn();
    renderStart(root, ctx, settings(), onStart);
    expect([...root.querySelectorAll(".check__meta")].map((e) => e.textContent)).toEqual([
      "2 spørsmål",
      "1 spørsmål",
    ]);
    const start = [...root.querySelectorAll("button")].find((b) => b.textContent === "Start")!;
    expect(start.disabled).toBe(false);

    [...root.querySelectorAll("button")].find((b) => b.textContent === "Fjern alle")!.click();
    expect(start.disabled).toBe(true);
    expect(root.querySelector("#start-status")?.textContent).toBe("Velg minst ett kompetansemål.");

    root.querySelector<HTMLInputElement>("#aim-a-2")!.click();
    expect(start.disabled).toBe(false);
    root.querySelector("form")!.dispatchEvent(new Event("submit", { cancelable: true }));
    expect(onStart).toHaveBeenCalledWith(expect.objectContaining({ aims: new Set(["a-2"]), length: 10 }));
  });

  it("enables 'Øv på det du bommet på sist' only when there are missed questions", () => {
    const ctx = makeCtx([single("t-0001", "a-1"), single("t-0002", "a-2")]);
    renderStart(root, ctx, settings(), vi.fn());
    expect(root.querySelector<HTMLInputElement>("#only-missed")!.disabled).toBe(true);

    ctx.store.update(ctx.pack.code, "t-0002", () => ({
      seen: 1,
      correct: 0,
      lastWrong: true,
      lastSeen: "2026-10-01",
    }));
    renderStart(root, ctx, settings(), vi.fn());
    const missed = root.querySelector<HTMLInputElement>("#only-missed")!;
    expect(missed.disabled).toBe(false);
    expect(root.querySelector(".check--solo .field__hint")?.textContent).toBe("1 spørsmål");
    root.querySelector<HTMLInputElement>("#aim-a-2")!.click(); // deselect the aim with the miss
    expect(missed.disabled).toBe(true);
  });
});

describe("result screen", () => {
  it("shows the score, highlights weak aims and offers to practise misses", () => {
    const qs = [tf("t-0001", "a-1", true), tf("t-0002", "a-2", true), tf("t-0003", "a-2", true)];
    const ctx = makeCtx(qs);
    const presenter = (q: Question) => present(q, seededRng(2), { true: "Sant", false: "Usant" });
    let s = createSession(qs, presenter);
    for (const choice of [1, 0, 0]) s = next(answer(s, choice, presenter).state).state; // a-1 wrong, a-2 right ×2
    const onPracticeMissed = vi.fn();
    renderResult(root, ctx, s, { onPracticeMissed, onNewRound: vi.fn() });

    expect(root.querySelector(".score")?.textContent).toBe("Du fikk 2 av 3 riktig på første forsøk.");
    const bars = [...root.querySelectorAll(".aim-bar")];
    expect(bars.map((b) => b.querySelector(".aim-bar__label")?.textContent)).toEqual(["Mål a-1", "Mål a-2"]);
    expect(bars[0]!.classList).toContain("aim-bar--low");
    expect(bars[0]!.textContent).toContain("Øv mer her");
    expect(bars[1]!.classList).not.toContain("aim-bar--low");

    [...root.querySelectorAll("button")]
      .find((b) => b.textContent === "Øv på spørsmålene du bommet på")!
      .click();
    expect(onPracticeMissed).toHaveBeenCalledWith(["t-0001"]);
  });
});
