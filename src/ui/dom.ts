/**
 * Tiny DOM helpers. Strings are always inserted as text nodes, so content is escaped by construction.
 */
export type Child = Node | string | number | false | null | undefined | Child[];

/** Attributes, plus `class`, `dataset`, `style` and `on<event>` listeners. */
type Props = Record<string, unknown>;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props | null = null,
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null || value === false) continue;
      if (key === "class") {
        el.className = Array.isArray(value) ? value.filter(Boolean).join(" ") : String(value);
      } else if (key === "dataset") {
        Object.assign(el.dataset, value);
      } else if (key === "style") {
        for (const [prop, v] of Object.entries(value as Record<string, string>))
          el.style.setProperty(prop, v);
      } else if (key.startsWith("on") && typeof value === "function") {
        el.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
      } else if (value === true) {
        el.setAttribute(key, "");
      } else {
        el.setAttribute(key, String(value));
      }
    }
  }
  append(el, children);
  return el;
}

export function append(parent: Node, children: Child[]): void {
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    if (Array.isArray(child)) append(parent, child);
    else parent.appendChild(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Replaces all children of `parent`. */
export function render(parent: Element, ...children: Child[]): void {
  parent.replaceChildren();
  append(parent, children);
}

/** Text only for assistive technology. */
export function srOnly(text: string): HTMLSpanElement {
  return h("span", { class: "sr-only" }, text);
}
