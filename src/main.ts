import "./styles/tokens.css";
import "./styles/app.css";
import { buildDeck } from "./domain/deck";
import { defaultRng } from "./domain/random";
import { isoDate } from "./domain/session";
import { loadPack, loadSubjects } from "./data/contentLoader";
import { createProgressStore } from "./data/progressStore";
import { focusHeading, type AppContext, type StartSettings } from "./ui/app";
import { h, render } from "./ui/dom";
import { renderQuiz } from "./ui/screens/quiz";
import { renderResult } from "./ui/screens/result";
import { renderStart } from "./ui/screens/start";
import { strings } from "./ui/strings.nb";

async function boot(root: HTMLElement): Promise<void> {
  render(root, h("p", { class: "loading", role: "status" }, strings.loading));

  let ctx: AppContext;
  try {
    const { subjects } = await loadSubjects();
    // One subject per session (§14.5). The subject picker arrives with the second pack (M3).
    const subject = subjects[0]!;
    const pack = await loadPack(subject);
    ctx = {
      subjects,
      subject,
      pack,
      store: createProgressStore(),
      rng: defaultRng,
      today: () => isoDate(new Date()),
      dev: import.meta.env.DEV,
    };
  } catch (err) {
    console.error(err);
    render(
      root,
      h(
        "section",
        { class: "screen" },
        h("p", { class: "error", role: "alert" }, strings.loadError),
        h(
          "button",
          { type: "button", class: "btn btn--primary", onclick: () => location.reload() },
          strings.reload,
        ),
      ),
    );
    return;
  }

  const settings: StartSettings = {
    aims: new Set(ctx.pack.aims.map((a) => a.id)),
    length: 10,
    onlyMissed: false,
  };

  const showStart = () => {
    renderStart(root, ctx, settings, (s) => startSession(s));
    focusHeading(root);
  };

  const startSession = (s: StartSettings, ids?: ReadonlySet<string>) => {
    const stats = ctx.store.get(ctx.pack.code);
    const deck = buildDeck(
      ctx.pack.questions,
      stats,
      ids ? { aims: s.aims, length: "all", ids } : s,
      ctx.rng,
    );
    if (deck.length === 0) return showStart();
    renderQuiz(root, ctx, deck, {
      onQuit: showStart,
      onFinish: (state) => {
        renderResult(root, ctx, state, {
          onPracticeMissed: (wrong) => startSession(s, new Set(wrong)),
          onNewRound: showStart,
        });
        focusHeading(root);
      },
    });
  };

  showStart();
}

const root = document.getElementById("app");
if (root) void boot(root);
