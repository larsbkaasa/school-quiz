import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { filterByStatus } from "../../src/domain/content";
import { PackSchema, QuestionSchema, SubjectIndexSchema } from "../../src/domain/schema";
import { pack, single, tf } from "../fixtures";

const image = {
  src: "tst01-01/bilde.webp",
  alt: "Et bilde av noe",
  width: 800,
  height: 600,
  credit: "Test",
  license: "CC BY 4.0",
};

const issues = (data: unknown) => {
  const r = PackSchema.safeParse(data);
  return r.success ? [] : r.error.issues.map((i) => i.message);
};

describe("schema", () => {
  it("accepts a valid pack and applies defaults", () => {
    const raw = pack([single("t-0001", "a-1"), tf("t-0002", "a-2", true)]);
    const q = { ...raw.questions[0] } as Record<string, unknown>;
    delete q.difficulty;
    delete q.imageRequired;
    const parsed = PackSchema.parse({ ...raw, questions: [q] });
    expect(parsed.questions[0]).toMatchObject({ difficulty: 1, imageRequired: false });
  });

  it("validates question ids, explain length and option count", () => {
    expect(QuestionSchema.safeParse(single("bad id", "a-1")).success).toBe(false);
    expect(QuestionSchema.safeParse(single("t-0001", "a-1", { explain: "x".repeat(301) })).success).toBe(
      false,
    );
    expect(QuestionSchema.safeParse(single("t-0001", "a-1", { options: ["a"] })).success).toBe(false);
    expect(
      QuestionSchema.safeParse(single("t-0001", "a-1", { options: ["a", "b", "c", "d", "e"] })).success,
    ).toBe(false);
  });

  it("validates images", () => {
    expect(QuestionSchema.safeParse(single("t-0001", "a-1", { image })).success).toBe(true);
    expect(
      QuestionSchema.safeParse(single("t-0001", "a-1", { image: { ...image, src: "tst01-01/Bilde.webp" } }))
        .success,
    ).toBe(false);
    expect(
      QuestionSchema.safeParse(single("t-0001", "a-1", { image: { ...image, src: "tst01-01/bilde.gif" } }))
        .success,
    ).toBe(false);
    expect(
      QuestionSchema.safeParse(single("t-0001", "a-1", { image: { ...image, alt: "kort" } })).success,
    ).toBe(false);
    expect(
      QuestionSchema.safeParse(single("t-0001", "a-1", { image: { ...image, credit: "" } })).success,
    ).toBe(false);
  });

  it("cross-field rules", () => {
    expect(issues(pack([single("t-0001", "a-1"), single("t-0001", "a-1")]))).toContain(
      'Duplicate question id "t-0001"',
    );
    expect(issues(pack([single("t-0001", "a-9")]))).toContain('Unknown aim "a-9"');
    expect(issues(pack([single("t-0001", "a-1", { answer: 3 })]))[0]).toMatch(/out of range/);
    expect(issues(pack([single("t-0001", "a-1", { options: ["Ja", "ja "] })]))).toContain(
      "Duplicate options",
    );
    expect(issues(pack([single("t-0001", "a-1", { imageRequired: true })]))[0]).toMatch(/imageRequired/);
    expect(
      issues(pack([single("t-0001", "a-1", { image: { ...image, src: "other/bilde.webp" } })]))[0],
    ).toMatch(/pack folder/);
  });

  it("filterByStatus keeps only approved questions in production", () => {
    const p = pack([
      single("t-0001", "a-1"),
      single("t-0002", "a-1", { status: "draft" }),
      single("t-0003", "a-1", { status: "review" }),
    ]);
    expect(filterByStatus(p, false).questions.map((q) => q.id)).toEqual(["t-0001"]);
    expect(filterByStatus(p, true).questions).toHaveLength(3);
  });

  it("the shipped content parses", () => {
    const index = SubjectIndexSchema.parse(JSON.parse(readFileSync("public/content/subjects.json", "utf8")));
    for (const s of index.subjects) {
      const parsed = PackSchema.parse(JSON.parse(readFileSync(`public/content/${s.file}`, "utf8")));
      expect(parsed.code).toBe(s.code);
    }
  });
});
