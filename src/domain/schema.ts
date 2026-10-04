import { z } from "zod";

export const QUESTION_STATUSES = ["draft", "review", "approved"] as const;

export const ImageSchema = z.object({
  src: z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+\.(webp|svg|jpg|png)$/),
  alt: z.string().min(5).max(150),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  credit: z.string().min(1),
  license: z.string().min(1),
  caption: z.string().max(120).optional(),
});

export const SourceSchema = z.object({
  name: z.string().min(1),
  url: z.url(),
  checked: z.iso.date(),
});

const Base = z.object({
  id: z.string().regex(/^[a-z]+-\d{4}$/),
  aim: z.string(),
  difficulty: z.number().int().min(1).max(3).default(1),
  q: z.string().min(5),
  explain: z.string().min(5).max(300),
  image: ImageSchema.optional(),
  imageRequired: z.boolean().default(false),
  source: SourceSchema,
  status: z.enum(QUESTION_STATUSES),
});

export const SingleQuestionSchema = Base.extend({
  type: z.literal("single"),
  options: z.array(z.string().min(1)).min(2).max(4),
  answer: z.number().int(),
});

export const TfQuestionSchema = Base.extend({
  type: z.literal("tf"),
  answer: z.boolean(),
});

export const QuestionSchema = z.discriminatedUnion("type", [SingleQuestionSchema, TfQuestionSchema]);

export const AimSchema = z.object({
  id: z.string().min(1),
  short: z.string().min(1),
  full: z.string().min(1),
});

export const PackSchema = z
  .object({
    schemaVersion: z.literal(1),
    code: z.string().min(1),
    name: z.string().min(1),
    language: z.literal("nb-NO"),
    curriculumUrl: z.url(),
    aims: z.array(AimSchema).min(1),
    questions: z.array(QuestionSchema),
  })
  .superRefine((pack, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });

    const aimIds = new Set<string>();
    pack.aims.forEach((aim, i) => {
      if (aimIds.has(aim.id)) issue(["aims", i, "id"], `Duplicate aim id "${aim.id}"`);
      aimIds.add(aim.id);
    });

    const imageFolder = `${pack.code.toLowerCase()}/`;
    const ids = new Set<string>();
    pack.questions.forEach((q, i) => {
      const at = (...rest: (string | number)[]) => ["questions", i, ...rest];
      if (ids.has(q.id)) issue(at("id"), `Duplicate question id "${q.id}"`);
      ids.add(q.id);
      if (!aimIds.has(q.aim)) issue(at("aim"), `Unknown aim "${q.aim}"`);
      if (q.type === "single") {
        if (q.answer < 0 || q.answer >= q.options.length) {
          issue(at("answer"), `answer ${q.answer} is out of range for ${q.options.length} options`);
        }
        const normalised = q.options.map((o) => o.trim().toLowerCase());
        if (new Set(normalised).size !== normalised.length) issue(at("options"), "Duplicate options");
      }
      if (q.image && !q.image.src.startsWith(imageFolder)) {
        issue(at("image", "src"), `Image must live in the pack folder "${imageFolder}"`);
      }
      if (q.imageRequired && !q.image)
        issue(at("imageRequired"), "imageRequired is set but there is no image");
    });
  });

export const SubjectIndexSchema = z.object({
  subjects: z
    .array(
      z.object({
        code: z.string().min(1),
        name: z.string().min(1),
        file: z.string().regex(/^[a-z0-9-]+\.json$/),
        grades: z.string(),
      }),
    )
    .min(1),
});
