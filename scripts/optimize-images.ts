/**
 * Image helper (§10): converts .jpg/.png in public/content/images/<pack>/ to WebP, resizes to at most
 * 1200 px on the longest side and writes width/height back into the pack. SVGs are left alone.
 *   pnpm images
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { SubjectIndexSchema } from "../src/domain/schema";

const MAX_SIDE = 1200;
const contentDir = join(process.cwd(), "public/content");
const imagesDir = join(contentDir, "images");

interface RawImage {
  src: string;
  width: number;
  height: number;
}

async function main(): Promise<void> {
  const index = SubjectIndexSchema.parse(JSON.parse(readFileSync(join(contentDir, "subjects.json"), "utf8")));
  for (const subject of index.subjects) {
    const packPath = join(contentDir, subject.file);
    const pack = JSON.parse(readFileSync(packPath, "utf8")) as {
      questions: { id: string; image?: RawImage }[];
    };
    let changed = false;

    for (const q of pack.questions) {
      const image = q.image;
      if (!image || image.src.endsWith(".svg")) continue;
      const input = join(imagesDir, image.src);
      if (!existsSync(input)) {
        console.warn(`${q.id}: ${image.src} not found, skipped`);
        continue;
      }
      const meta = await sharp(input).metadata();
      if (
        image.src.endsWith(".webp") &&
        meta.width === image.width &&
        meta.height === image.height &&
        Math.max(meta.width, meta.height) <= MAX_SIDE
      ) {
        continue; // Already optimised; don't re-encode a lossy file.
      }
      const src = image.src.replace(/\.(jpe?g|png|webp)$/i, ".webp");
      const output = join(imagesDir, src);
      const buffer = await sharp(readFileSync(input))
        .rotate()
        .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 78 })
        .toBuffer({ resolveWithObject: true });
      writeFileSync(output, buffer.data);
      if (output !== input) rmSync(input);

      const { width, height } = buffer.info;
      if (image.src !== src || image.width !== width || image.height !== height) {
        Object.assign(image, { src, width, height });
        changed = true;
      }
      console.log(`${q.id}: ${src} ${width}×${height}, ${Math.round(buffer.data.length / 1024)} KB`);
    }

    if (changed) {
      writeFileSync(packPath, JSON.stringify(pack, null, 2) + "\n");
      console.log(`Updated ${subject.file}`);
    }
  }
}

await main();
