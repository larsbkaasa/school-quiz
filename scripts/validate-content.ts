/**
 * Content validator (§6.5, §10). Usage:
 *   pnpm validate                                  # validate everything in public/content
 *   pnpm validate --export-review mhe01-03.csv     # also write a teacher review sheet for that pack
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { imageSize } from "image-size";
import { PackSchema, SubjectIndexSchema } from "../src/domain/schema";
import type { Pack } from "../src/domain/types";

export const MAX_RASTER_BYTES = 150 * 1024;
export const MAX_SVG_BYTES = 50 * 1024;
export const MAX_IMAGE_SIDE = 1200;
export const SOURCE_MAX_AGE_MONTHS = 18;
export const MIN_APPROVED_PER_AIM = 5;

export interface Report {
  errors: string[];
  warnings: string[];
  packs: { file: string; pack: Pack }[];
}

function monthsBetween(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`);
  const b = new Date(`${to}T00:00:00Z`);
  return (
    (b.getUTCFullYear() - a.getUTCFullYear()) * 12 +
    (b.getUTCMonth() - a.getUTCMonth()) -
    (b.getUTCDate() < a.getUTCDate() ? 1 : 0)
  );
}

/** Returns problems with an SVG's markup that make it unsafe to ship (§6.4). */
export function svgSafetyIssues(svg: string): string[] {
  const issues: string[] = [];
  if (/<script[\s>]/i.test(svg)) issues.push("contains <script>");
  if (/\son[a-z]+\s*=/i.test(svg)) issues.push("contains an event handler attribute");
  if (/<foreignObject[\s>]/i.test(svg)) issues.push("contains <foreignObject>");
  if (/(?:xlink:)?href\s*=\s*["'](?!#)/i.test(svg)) issues.push("references an external resource (href)");
  if (/url\(\s*["']?(?!#)/i.test(svg)) issues.push("references an external resource (url())");
  if (/@import/i.test(svg)) issues.push("contains @import");
  if (/javascript:/i.test(svg)) issues.push("contains a javascript: URL");
  return issues;
}

function svgSize(svg: string): { width?: number; height?: number } {
  const root = /<svg\b[^>]*>/i.exec(svg)?.[0] ?? "";
  const num = (name: string) => {
    const m = new RegExp(`\\s${name}\\s*=\\s*["']\\s*([\\d.]+)(?:px)?\\s*["']`, "i").exec(root);
    return m?.[1] ? Number(m[1]) : undefined;
  };
  let width = num("width");
  let height = num("height");
  const vb = /\sviewBox\s*=\s*["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)\s*["']/i.exec(root);
  if (vb) {
    width ??= Number(vb[1]);
    height ??= Number(vb[2]);
  }
  return { width, height };
}

function listFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });
}

export function validateContent(contentDir: string, today: string): Report {
  const report: Report = { errors: [], warnings: [], packs: [] };
  const error = (msg: string): void => void report.errors.push(msg);
  const warn = (msg: string): void => void report.warnings.push(msg);
  const imagesDir = join(contentDir, "images");

  let index;
  try {
    const parsed = SubjectIndexSchema.safeParse(
      JSON.parse(readFileSync(join(contentDir, "subjects.json"), "utf8")),
    );
    if (!parsed.success) {
      error(
        `subjects.json: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
      );
      return report;
    }
    index = parsed.data;
  } catch (e) {
    error(`subjects.json: ${(e as Error).message}`);
    return report;
  }

  const referencedImages = new Set<string>();
  for (const subject of index.subjects) {
    const file = subject.file;
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(join(contentDir, file), "utf8"));
    } catch (e) {
      error(`${file}: ${(e as Error).message}`);
      continue;
    }
    const parsed = PackSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const path = issue.path.slice();
        // Make question paths readable: questions.12 → questions[12] (mhe-0013)
        let where = path.join(".");
        if (path[0] === "questions" && typeof path[1] === "number") {
          const id = (raw as { questions?: { id?: string }[] }).questions?.[path[1]]?.id;
          where = `questions[${path[1]}]${id ? ` (${id})` : ""}${path.length > 2 ? "." + path.slice(2).join(".") : ""}`;
        }
        error(`${file}: ${where}: ${issue.message}`);
      }
      continue;
    }
    const pack = parsed.data;
    report.packs.push({ file, pack });
    if (pack.code !== subject.code)
      error(`${file}: code "${pack.code}" does not match subjects.json "${subject.code}"`);

    for (const q of pack.questions) {
      const where = `${file}: ${q.id}`;
      const age = monthsBetween(q.source.checked, today);
      if (age > SOURCE_MAX_AGE_MONTHS)
        warn(`${where}: source checked ${q.source.checked} (${age} months ago) – re-check it`);
      if (age < 0) error(`${where}: source.checked ${q.source.checked} is in the future`);
      if (q.image) referencedImages.add(q.image.src);
      if (q.image) checkImage(q.image, where);
    }

    for (const aim of pack.aims) {
      const approved = pack.questions.filter((q) => q.aim === aim.id && q.status === "approved").length;
      if (approved < MIN_APPROVED_PER_AIM)
        warn(`${file}: aim ${aim.id} has ${approved} approved questions (want ≥ ${MIN_APPROVED_PER_AIM})`);
    }
  }

  for (const path of listFiles(imagesDir)) {
    const rel = relative(imagesDir, path).split("\\").join("/");
    if (!referencedImages.has(rel)) warn(`images/${rel}: not used by any question (orphaned)`);
  }

  return report;

  function checkImage(image: NonNullable<Pack["questions"][number]["image"]>, where: string): void {
    const path = join(imagesDir, image.src);
    if (!existsSync(path)) return error(`${where}: image ${image.src} does not exist`);
    const ext = extname(path).toLowerCase();
    const bytes = statSync(path).size;
    if (ext === ".jpg" || ext === ".png") warn(`${where}: ${image.src} – prefer .webp (run pnpm images)`);
    if (ext === ".svg") {
      if (bytes > MAX_SVG_BYTES)
        error(
          `${where}: ${image.src} is ${Math.round(bytes / 1024)} KB (SVG max ${MAX_SVG_BYTES / 1024} KB)`,
        );
      const svg = readFileSync(path, "utf8");
      for (const issue of svgSafetyIssues(svg)) error(`${where}: ${image.src} ${issue}`);
      const size = svgSize(svg);
      if (size.width !== image.width || size.height !== image.height) {
        warn(
          `${where}: ${image.src} is ${size.width}×${size.height} but the pack says ${image.width}×${image.height}`,
        );
      }
      return;
    }
    if (bytes > MAX_RASTER_BYTES)
      error(`${where}: ${image.src} is ${Math.round(bytes / 1024)} KB (max ${MAX_RASTER_BYTES / 1024} KB)`);
    try {
      const dim = imageSize(readFileSync(path));
      if (dim.width !== image.width || dim.height !== image.height) {
        error(
          `${where}: ${image.src} is ${dim.width}×${dim.height} but the pack says ${image.width}×${image.height}`,
        );
      }
      if (Math.max(dim.width, dim.height) > MAX_IMAGE_SIDE)
        error(`${where}: ${image.src} is larger than ${MAX_IMAGE_SIDE}px`);
    } catch (e) {
      error(`${where}: ${image.src} could not be read: ${(e as Error).message}`);
    }
  }
}

function csvCell(value: unknown): string {
  const s = value === undefined || value === null ? "" : String(value);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** A review sheet a teacher can open in a spreadsheet (§10 step 4). */
export function reviewCsv(pack: Pack): string {
  const aims = new Map(pack.aims.map((a) => [a.id, a.short]));
  const header = [
    "id",
    "status",
    "aim",
    "type",
    "difficulty",
    "question",
    "options",
    "answer",
    "explain",
    "image",
    "image_alt",
    "source",
    "source_checked",
    "reviewer_comment",
  ];
  const rows = pack.questions.map((q) => [
    q.id,
    q.status,
    aims.get(q.aim) ?? q.aim,
    q.type,
    q.difficulty,
    q.q,
    q.type === "single"
      ? q.options.map((o, i) => `${String.fromCharCode(65 + i)}) ${o}`).join(" | ")
      : "Sant | Usant",
    q.type === "single" ? q.options[q.answer] : q.answer ? "Sant" : "Usant",
    q.explain,
    q.image ? `public/content/images/${q.image.src}` : "",
    q.image?.alt ?? "",
    `${q.source.name} (${q.source.url})`,
    q.source.checked,
    "",
  ]);
  return "\uFEFF" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

function main(argv: string[]): number {
  const contentDir = resolve(process.cwd(), "public/content");
  const today = new Date().toISOString().slice(0, 10);
  const report = validateContent(contentDir, today);

  for (const w of report.warnings) console.warn(`warning  ${w}`);
  for (const e of report.errors) console.error(`error    ${e}`);
  const questions = report.packs.reduce((n, p) => n + p.pack.questions.length, 0);
  console.log(
    `\n${report.packs.length} pack(s), ${questions} question(s): ${report.errors.length} error(s), ${report.warnings.length} warning(s)`,
  );

  const exportIdx = argv.indexOf("--export-review");
  if (exportIdx !== -1) {
    const out = argv[exportIdx + 1];
    if (!out) {
      console.error("--export-review needs a file name, e.g. mhe01-03.csv");
      return 1;
    }
    const packFile = `${basename(out, extname(out))}.json`;
    const entry = report.packs.find((p) => p.file === packFile);
    if (!entry) {
      console.error(`No valid pack named ${packFile} to export`);
      return 1;
    }
    writeFileSync(out, reviewCsv(entry.pack));
    console.log(`Wrote review sheet ${out}`);
  }
  return report.errors.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exit(main(process.argv.slice(2)));
}
