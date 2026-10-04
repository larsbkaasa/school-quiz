import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { reviewCsv, svgSafetyIssues, validateContent } from "../../scripts/validate-content";
import { pack, single } from "../fixtures";

function contentDir(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "skolequiz-"));
  for (const [name, body] of Object.entries(files)) {
    const path = join(dir, name);
    writeFileSync(path, body);
  }
  return dir;
}

const subjects = JSON.stringify({
  subjects: [{ code: "TST01-01", name: "Test", file: "tst01-01.json", grades: "8–10" }],
});

describe("validate-content", () => {
  it("the repository content has no errors", () => {
    const report = validateContent("public/content", "2026-10-04");
    expect(report.errors).toEqual([]);
    expect(report.packs.length).toBeGreaterThan(0);
  });

  it("reports schema errors with question ids", () => {
    const bad = pack([single("t-0001", "a-1", { answer: 7 })]);
    const dir = contentDir({ "subjects.json": subjects, "tst01-01.json": JSON.stringify(bad) });
    const report = validateContent(dir, "2026-10-04");
    expect(report.errors.join("\n")).toMatch(/questions\[0\] \(t-0001\)\.answer: answer 7 is out of range/);
  });

  it("warns about old sources and thin aims, errors on missing images", () => {
    const p = pack([
      single("t-0001", "a-1", { source: { name: "x", url: "https://example.org/", checked: "2024-01-01" } }),
      single("t-0002", "a-1", {
        image: {
          src: "tst01-01/mangler.webp",
          alt: "Et bilde",
          width: 10,
          height: 10,
          credit: "x",
          license: "y",
        },
      }),
    ]);
    const dir = contentDir({ "subjects.json": subjects, "tst01-01.json": JSON.stringify(p) });
    const report = validateContent(dir, "2026-10-04");
    expect(report.warnings.join("\n")).toMatch(/t-0001: source checked 2024-01-01/);
    expect(report.warnings.join("\n")).toMatch(/aim a-1 has 2 approved questions/);
    expect(report.errors.join("\n")).toMatch(/mangler\.webp does not exist/);
  });

  it("flags unsafe SVG content", () => {
    expect(svgSafetyIssues('<svg><rect fill="url(#g)"/><use href="#a"/></svg>')).toEqual([]);
    expect(svgSafetyIssues("<svg><script>alert(1)</script></svg>")).toContain("contains <script>");
    expect(svgSafetyIssues('<svg onload="x()"></svg>')).toContain("contains an event handler attribute");
    expect(svgSafetyIssues('<svg><image href="https://evil.example/x.png"/></svg>')).toContain(
      "references an external resource (href)",
    );
    expect(svgSafetyIssues('<svg><rect style="fill:url(https://x)"/></svg>')).toContain(
      "references an external resource (url())",
    );
  });

  it("exports a review CSV with the correct answer spelled out", () => {
    const csv = reviewCsv(pack([single("t-0001", "a-1", { options: ["A, med komma", "B"], answer: 0 })]));
    expect(csv.startsWith("\uFEFF")).toBe(true); // Excel needs the BOM to read UTF-8
    const lines = csv.trim().split("\r\n");
    expect(lines[0]).toMatch(/^id,status,aim,type/);
    expect(lines[1]).toContain('"A) A, med komma | B) B","A, med komma"');
  });

  it("the review CSV of the shipped pack has one row per question", () => {
    const report = validateContent("public/content", "2026-10-04");
    const { pack: p } = report.packs[0]!;
    expect(reviewCsv(p).trim().split("\r\n")).toHaveLength(p.questions.length + 1);
    expect(readFileSync("public/content/subjects.json", "utf8")).toContain(p.code);
  });
});
