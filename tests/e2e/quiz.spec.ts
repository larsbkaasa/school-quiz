import { expect, test } from "@playwright/test";
import { answerAll, expectNoA11yViolations, fixturePack, nextButton, pick, useFixturePack } from "./helpers";

test.describe("with the real content", () => {
  test("a full 10-question session reaches results without a11y violations", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Skolequiz" })).toBeVisible();
    await expect(page.getByText("Fremgangen din lagres bare i denne nettleseren.")).toBeVisible();
    await expectNoA11yViolations(page);

    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByText(/Spørsmål 1 av 10/)).toBeVisible();
    await expectNoA11yViolations(page);

    await page.keyboard.press("1");
    await expect(page.locator("[aria-live=polite]").filter({ hasText: /Riktig!|Ikke helt/ })).toBeVisible();
    await expectNoA11yViolations(page);

    await nextButton(page).click();
    await answerAll(page);
    await expect(page.getByText(/Du fikk \d+ av 10 riktig på første forsøk/)).toBeVisible();
    await expectNoA11yViolations(page);

    await page.getByRole("button", { name: "Ny runde" }).click();
    await expect(page.getByRole("heading", { name: "Skolequiz" })).toBeVisible();
  });

  test("dark mode has no a11y violations", async ({ page }) => {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto("/");
    await expectNoA11yViolations(page);
    await page.getByRole("button", { name: "Start" }).click();
    await page.keyboard.press("1");
    await expectNoA11yViolations(page);
  });

  test("ships a strict CSP and makes no third-party requests", async ({ page }) => {
    const external: string[] = [];
    page.on("request", (r) => {
      if (!r.url().startsWith("http://localhost")) external.push(r.url());
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Start" }).click();
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
    expect(csp).toContain("default-src 'self'");
    expect(external).toEqual([]);
  });
});

test.describe("with fixture content", () => {
  test.beforeEach(async ({ page }) => {
    await useFixturePack(page);
  });

  test("a wrong answer is re-queued and results are per aim", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByText("Spørsmål 1 av 2")).toBeVisible();

    // Answer whichever question comes first wrongly.
    const first = await page.locator("#question-text").textContent();
    const wrong = first?.includes("kylling") ? "Sant" : "Ingenting";
    await pick(page, wrong);
    await expect(page.getByText(/Ikke helt\. Riktig svar:/)).toBeVisible();
    await expect(page.getByText("Du får dette spørsmålet igjen litt senere.")).toBeVisible();
    await expect(page.getByText("Spørsmål 1 av 3")).toBeVisible();

    await nextButton(page).click();
    const right = (await page.locator("#question-text").textContent())?.includes("kylling")
      ? "Usant"
      : "Skru kjøleskapet kaldere";
    await pick(page, right);
    await expect(page.getByText("Riktig!")).toBeVisible();
    await page.keyboard.press("Enter");

    // The re-queued question again; answer it right this time.
    await expect(page.locator("#question-text")).toHaveText(first!);
    const retryRight = first?.includes("kylling") ? "Usant" : "Skru kjøleskapet kaldere";
    await pick(page, retryRight);
    await nextButton(page).click();

    await expect(page.getByText("Du fikk 1 av 2 riktig på første forsøk.")).toBeVisible();
    const bars = page.locator(".aim-bar");
    await expect(bars).toHaveCount(2);
    await expect(page.locator(".aim-bar--low")).toHaveCount(1);
    await expect(page.locator(".aim-bar--low")).toContainText("Øv mer her");
    await expect(page.getByRole("button", { name: "Øv på spørsmålene du bommet på" })).toBeVisible();
  });

  test("progress persists across reloads", async ({ page }) => {
    await page.goto("/");
    const missed = page.getByLabel(/Øv på det du bommet på sist/);
    await expect(missed).toBeDisabled();

    await page.getByRole("button", { name: "Start" }).click();
    const isTf = (await page.locator("#question-text").textContent())?.includes("kylling");
    await pick(page, isTf ? "Sant" : "Ingenting");
    await page.reload();

    await expect(missed).toBeEnabled();
    await expect(page.getByText("1 spørsmål", { exact: true }).last()).toBeVisible();
    await missed.check();
    await page.getByRole("button", { name: "Start" }).click();
    await expect(page.getByText("Spørsmål 1 av 1")).toBeVisible();
  });

  test("question images render with alt text and credit", async ({ page }) => {
    await useFixturePack(page, { ...fixturePack, questions: [fixturePack.questions[1]] });
    await page.goto("/");
    await page.getByRole("button", { name: "Start" }).click();
    const img = page.getByRole("img", { name: /termometer i et kjøleskap/ });
    await expect(img).toBeVisible();
    expect(await img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    await expect(page.getByText("Bilde: Skolequiz (Egen produksjon)")).toBeVisible();
    await expectNoA11yViolations(page);
  });

  test("a question whose required image fails to load is skipped", async ({ page }) => {
    await page.route("**/images/mhe01-03/kjoleskapstermometer.svg", (route) =>
      route.fulfill({ status: 404 }),
    );
    await page.goto("/");
    await page.getByRole("button", { name: "Start" }).click();
    // The deck order is random. Either the image question comes first and is skipped at once,
    // or it comes second and is skipped when shown, which ends the session.
    await expect(page.locator("#question-text")).toHaveText("Rå kylling bør skylles før steking.");
    await expect(page.getByText(/Spørsmål 1 av [12]/)).toBeVisible();
    await pick(page, "Usant");
    await nextButton(page).click();
    await expect(page.getByText("Du fikk 1 av 1 riktig på første forsøk.")).toBeVisible();
  });
});

test("shows a friendly error when content cannot be loaded", async ({ page }) => {
  await page.route("**/content/subjects.json", (route) => route.fulfill({ status: 500 }));
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("Vi fikk ikke lastet spørsmålene");
});
