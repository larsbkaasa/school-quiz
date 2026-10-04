import type { QuestionImage } from "../../domain/types";
import { imageUrl } from "../../data/contentLoader";
import { h } from "../dom";
import { strings } from "../strings.nb";

/**
 * <figure> with intrinsic size set (no layout shift). On load error the figure is hidden and
 * `onError` is called so the caller can skip questions that need the image.
 */
export function questionImage(image: QuestionImage, onError: () => void): HTMLElement {
  const img = h("img", {
    src: imageUrl(image.src),
    alt: image.alt,
    width: image.width,
    height: image.height,
    decoding: "async",
    class: "question-image__img",
  });
  const figure = h(
    "figure",
    { class: "question-image" },
    img,
    image.caption ? h("figcaption", { class: "question-image__caption" }, image.caption) : null,
    h("small", { class: "question-image__credit" }, strings.imageCredit(image.credit, image.license)),
  );
  img.addEventListener(
    "error",
    () => {
      figure.hidden = true;
      onError();
    },
    { once: true },
  );
  return figure;
}

/** Warms the browser cache so the next question's image appears instantly. */
export function preloadImage(image: QuestionImage | undefined): void {
  if (!image) return;
  const img = new Image();
  img.src = imageUrl(image.src);
}
