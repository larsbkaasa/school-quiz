import type { SessionLength } from "../domain/deck";
import type { Rng } from "../domain/random";
import type { Pack, Subject } from "../domain/types";
import type { ProgressStore } from "../data/progressStore";

export interface StartSettings {
  aims: Set<string>;
  length: SessionLength;
  onlyMissed: boolean;
}

export interface AppContext {
  subjects: Subject[];
  subject: Subject;
  pack: Pack;
  store: ProgressStore;
  rng: Rng;
  today: () => string;
  /** Dev build: unapproved questions are visible. */
  dev: boolean;
}

/** Moves focus to the screen's main heading so screen readers announce the new screen. */
export function focusHeading(root: Element): void {
  const heading = root.querySelector<HTMLElement>("[data-screen-heading]");
  heading?.focus({ preventScroll: false });
}
