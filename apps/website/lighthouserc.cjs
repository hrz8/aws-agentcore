/*
 * Lighthouse-CI config. The Showcase Surface URL is included only when
 * INCLUDE_DESIGN_TOKENS=1 — prod builds prune dist/internal/ so asserting
 * against that URL would 404. See ADR-0002 §8.
 *
 * Assertions split via assertMatrix:
 *  - baseline (every URL): errors-in-console clean, a11y ≥ 95
 *  - showcase only: mobile Performance ≥ 90, CLS ≈ 0, LCP < 2.5s — the
 *    tight numbers are the verification AC for the design-token surface,
 *    not a target the placeholder home page is held to.
 *
 * The CLS upper bound is 0.001 rather than exactly 0 to absorb sub-pixel
 * measurement jitter on CI runners (e.g. font swap timing producing
 * ~0.00008 CLS); it remains well below the WCAG "Good" 0.1 threshold.
 */
const includeShowcase = process.env.INCLUDE_DESIGN_TOKENS === '1';

const baseUrls = ['http://localhost/'];
const showcaseUrl = 'http://localhost/internal/design-tokens/';

module.exports = {
  ci: {
    collect: {
      staticDistDir: './dist',
      numberOfRuns: 1,
      url: includeShowcase ? [...baseUrls, showcaseUrl] : baseUrls,
      settings: {
        chromeFlags: '--no-sandbox --headless=new',
      },
    },
    assert: {
      assertMatrix: [
        {
          matchingUrlPattern: '.*',
          assertions: {
            'errors-in-console': ['error', { minScore: 1 }],
            'categories:accessibility': ['error', { minScore: 0.95 }],
          },
        },
        {
          matchingUrlPattern: '.*/internal/design-tokens/?$',
          assertions: {
            'categories:performance': ['error', { minScore: 0.9 }],
            'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
            'cumulative-layout-shift': ['error', { maxNumericValue: 0.001 }],
          },
        },
      ],
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
