import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/", "dist-e2e/", "node_modules/", "test-results/", "playwright-report/"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
  {
    // §5.2: the domain layer is pure TS — no UI, data or DOM access.
    files: ["src/domain/**/*.ts"],
    languageOptions: { globals: {} },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/ui/**", "**/data/**", "../ui", "../data"],
              message: "src/domain must not import from ui or data.",
            },
          ],
        },
      ],
      "no-restricted-globals": ["error", "window", "document", "localStorage", "navigator", "fetch"],
    },
  },
  {
    // §8.3: never assign content strings via innerHTML.
    files: ["src/**/*.ts"],
    rules: {
      "no-restricted-properties": [
        "error",
        { property: "innerHTML", message: "Use textContent or the h() helper." },
        { property: "outerHTML", message: "Use textContent or the h() helper." },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
          message: "Use the h() helper.",
        },
      ],
    },
  },
);
