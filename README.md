# Skolequiz

Interactive practice quiz for ungdomsskolen (8.–10. trinn), aligned to LK20 competence aims. The first subject is **Mat og helse (MHE01-03)**.

- Immediate feedback with an explanation after every answer.
- Missed questions come back later in the same round and are prioritised in the next session.
- Results per competence aim.
- No accounts, no tracking. Progress stays in the browser (`localStorage`).

The design is described in [`docs/DESIGN.md`](docs/DESIGN.md). This repository implements **M1 (MVP)**.

## Getting started

Requires Node 22 and pnpm (`corepack enable`).

```sh
pnpm install
pnpm dev          # http://localhost:5173 – dev builds also show draft/review questions
```

| Script           | What it does                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`       | Vite dev server                                                                                                  |
| `pnpm build`     | Production build to `dist/` (only `approved` questions ship)                                                     |
| `pnpm preview`   | Serve `dist/`                                                                                                    |
| `pnpm lint`      | ESLint + Prettier check (`pnpm format` to fix)                                                                   |
| `pnpm typecheck` | `tsc --noEmit`                                                                                                   |
| `pnpm validate`  | Validate content packs and images (`--export-review mhe01-03.csv` writes a review sheet)                         |
| `pnpm images`    | Convert `.jpg`/`.png` question images to WebP, resize to ≤ 1200 px and write `width`/`height` back into the pack |
| `pnpm test`      | Unit and DOM tests (Vitest, happy-dom)                                                                           |
| `pnpm size`      | Fail if gzipped JS + CSS in `dist/` exceeds 150 KB                                                               |
| `pnpm test:e2e`  | Playwright + axe against `pnpm preview` (run `pnpm build` first)                                                 |

If your Playwright browser revision doesn't match `@playwright/test`, point it at an installed Chromium:
`PLAYWRIGHT_CHROMIUM_EXECUTABLE=/path/to/chrome pnpm test:e2e`.

## Project layout

```
src/domain/   pure TS: Zod schema, deck selection, session engine, evaluation, results (no DOM)
src/data/     content loader, localStorage progress store with in-memory fallback
src/ui/       screens (start, quiz, result), components, h() DOM helper, strings.nb.ts
public/content/   subjects.json, one JSON pack per subject, images/<pack>/
scripts/      validate-content.ts, optimize-images.ts, check-size.ts
tests/unit/   Vitest (domain, store, validator, screens in happy-dom)
tests/e2e/    Playwright + axe
```

ESLint enforces the layering: `src/domain` cannot import `ui`/`data` or use `window`/`document`, and `innerHTML` is banned in `src/`.

## Content workflow

1. Add questions to `public/content/<pack>.json` with `"status": "draft"`, a source and a `checked` date. Question IDs are permanent: **never reuse or renumber them**, because progress is stored by ID.
2. Put images in `public/content/images/<pack>/` (WebP or SVG, lowercase `a-z0-9-` names) with `alt`, `credit` and `license`. The alt text must give what is needed to answer without giving the answer away.
3. Run `pnpm validate`. CI runs the same checks.
4. A teacher reviews the questions (in the PR, or using `pnpm validate --export-review mhe01-03.csv`), then sets `"status": "approved"`.

## Deployment

CI (`.github/workflows/ci.yml`) runs lint → typecheck → validate → unit tests → build → bundle size → E2E/axe, then deploys `dist/` to **GitHub Pages** on pushes to the default branch.
One-time setup: in the repository's settings, go to **Pages → Build and deployment → Source** and choose **GitHub Actions**.

GitHub Pages can't set response headers, so the Content-Security-Policy ships as a `<meta>` tag (added only in production builds). If the app moves to Azure Static Web Apps, move the CSP to a response header there and add PR preview environments.

## Fonts

Bricolage Grotesque and Atkinson Hyperlegible are self-hosted from `public/fonts/` under the SIL Open Font License (license files are next to the fonts).
Digits in body text use Bricolage Grotesque, because Atkinson's slashed zero reads like the letter "Ø" in Norwegian.
