/*
 * Stylelint config — enforces ADR-0002 design-token discipline at lint time.
 * Rules:
 *   - design-tokens/no-raw-hex   — raw #rrggbb outside @theme fails
 *   - design-tokens/no-raw-px    — raw px in font-size/margin/padding/radius fails
 *                                  (1px hairline borders excepted)
 *
 * Tailwind class allowlist (e.g. p-8 forbidden) lives in
 * `scripts/lint-utility-classes.mjs` — stylelint cannot see HTML class= attributes.
 */
export default {
  extends: ['stylelint-config-standard'],
  plugins: ['./scripts/stylelint-plugin-design-tokens.mjs'],
  rules: {
    'design-tokens/no-raw-hex': true,
    'design-tokens/no-raw-px': true,
    // Tailwind v4 / Astro emits at-rules (@theme, @layer, @apply) that stylelint
    // doesn't ship rules for; relax the noise so real findings stay visible.
    'at-rule-no-unknown': [true, { ignoreAtRules: ['theme', 'layer', 'apply', 'utility', 'variants', 'responsive', 'screen'] }],
    'declaration-empty-line-before': null,
    'custom-property-empty-line-before': null,
    'no-descending-specificity': null,
    'selector-class-pattern': null,
    'custom-property-pattern': null,
    'media-feature-range-notation': null,
    // Tailwind v4 prefers bare `@import "tailwindcss"`; keep Figma's 6-digit hex.
    'import-notation': null,
    'color-hex-length': null,
  },
  overrides: [
    {
      files: ['**/*.astro'],
      customSyntax: 'postcss-html',
    },
  ],
  ignoreFiles: ['dist/**', 'node_modules/**', '.astro/**'],
};
