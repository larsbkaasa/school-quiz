import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

/** §9: strict CSP. GitHub Pages can't set headers, so it ships as a <meta> in production builds. */
const CSP = [
  "default-src 'self'",
  "img-src 'self' data:",
  "script-src 'self'",
  "style-src 'self'",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

function cspMeta(): Plugin {
  return {
    name: "skolequiz:csp",
    apply: "build",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: { "http-equiv": "Content-Security-Policy", content: CSP },
        injectTo: "head-prepend",
      },
    ],
  };
}

/** §6.5: production builds ship only approved questions. */
function approvedContentOnly(includeUnapproved: boolean): Plugin {
  let outDir = "dist";
  return {
    name: "skolequiz:approved-content",
    apply: "build",
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    async closeBundle() {
      if (includeUnapproved) return;
      // Content is schema-checked by `pnpm validate`; here we only drop unapproved questions and minify.
      const contentDir = resolve(outDir, "content");
      const index = JSON.parse(await readFile(resolve(contentDir, "subjects.json"), "utf8")) as {
        subjects: { file: string }[];
      };
      for (const subject of index.subjects) {
        const file = resolve(contentDir, subject.file);
        const pack = JSON.parse(await readFile(file, "utf8")) as { questions: { status: string }[] };
        const approved = pack.questions.filter((q) => q.status === "approved");
        const dropped = pack.questions.length - approved.length;
        await writeFile(file, JSON.stringify({ ...pack, questions: approved }));
        this.info(
          `${subject.file}: ${approved.length} approved questions (${dropped} not approved, removed)`,
        );
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  base: process.env.BASE_PATH ?? "/",
  plugins: [cspMeta(), approvedContentOnly(mode === "development" || process.env.INCLUDE_UNAPPROVED === "1")],
  build: {
    target: "es2022",
    sourcemap: true,
  },
}));
