/** Fails if the gzipped JS+CSS in dist/ exceeds the budget (§1, §12). Images, fonts and content are excluded. */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { gzipSync } from "node:zlib";

const BUDGET_BYTES = 150 * 1024;
const dist = join(process.cwd(), "dist");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

let total = 0;
for (const file of walk(dist).filter((f) => [".js", ".css"].includes(extname(f)))) {
  const gz = gzipSync(readFileSync(file), { level: 9 }).length;
  total += gz;
  console.log(`${(gz / 1024).toFixed(1).padStart(7)} KB  ${relative(dist, file)}`);
}
console.log(`${(total / 1024).toFixed(1).padStart(7)} KB  total (budget ${BUDGET_BYTES / 1024} KB, gzipped)`);
if (total > BUDGET_BYTES) {
  console.error("Bundle size budget exceeded.");
  process.exit(1);
}
