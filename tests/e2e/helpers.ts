import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

export const fixturePack = {
  schemaVersion: 1,
  code: "MHE01-03",
  name: "Mat og helse",
  language: "nb-NO",
  curriculumUrl: "https://www.udir.no/lk20/mhe01-03",
  aims: [
    { id: "a-1", short: "Hygiene", full: "Hygiene og mattrygghet" },
    { id: "a-2", short: "Merking", full: "Merking og forbrukermakt" },
  ],
  questions: [
    {
      id: "mhe-9001",
      aim: "a-1",
      type: "tf",
      q: "Rå kylling bør skylles før steking.",
      answer: false,
      explain: "Vannsprut sprer bakterier.",
      source: { name: "Test", url: "https://example.org/", checked: "2026-10-01" },
      status: "approved",
    },
    {
      id: "mhe-9002",
      aim: "a-2",
      type: "single",
      q: "Hva bør du gjøre?",
      image: {
        src: "mhe01-03/kjoleskapstermometer.svg",
        alt: "Et termometer i et kjøleskap. Den røde væskesøylen står på 9 grader.",
        width: 600,
        height: 600,
        credit: "Skolequiz",
        license: "Egen produksjon",
      },
      imageRequired: true,
      options: ["Skru kjøleskapet kaldere", "Ingenting"],
      answer: 0,
      explain: "Kjøleskapet bør holde 4 °C eller kaldere.",
      source: { name: "Test", url: "https://example.org/", checked: "2026-10-01" },
      status: "approved",
    },
  ],
};

/** Serves the small fixture pack instead of the real content. */
export async function useFixturePack(page: Page, pack: unknown = fixturePack): Promise<void> {
  await page.route("**/content/mhe01-03.json", (route) => route.fulfill({ json: pack }));
}

export async function expectNoA11yViolations(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
}

export const nextButton = (page: Page) => page.getByRole("button", { name: /Neste spørsmål|Se resultatet/ });

/** Answers questions with the given option until the results screen appears. */
export async function answerAll(page: Page, option = "1"): Promise<void> {
  for (let i = 0; i < 200; i++) {
    if (await page.getByRole("heading", { name: "Resultat" }).isVisible()) return;
    await page.keyboard.press(option);
    await nextButton(page).click();
  }
  throw new Error("Never reached the results screen");
}

/** Clicks the answer option with exactly this label. */
export async function pick(page: Page, label: string): Promise<void> {
  await page.getByRole("button", { name: label, exact: true }).click();
}
