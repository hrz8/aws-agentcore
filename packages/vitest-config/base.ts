import {
  configDefaults,
  coverageConfigDefaults,
  defineConfig,
} from 'vitest/config';

export default defineConfig({
  test: {
    globals: false,
    passWithNoTests: true,
    reporters: process.env.CI ? ['default', 'github-actions'] : ['default'],
    testTimeout: 10_000,
    hookTimeout: 10_000,
    exclude: [
      ...configDefaults.exclude,
      '**/.turbo/**',
      '**/.output/**',
      '**/.tanstack/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        ...coverageConfigDefaults.exclude,
        '**/*.config.{ts,js,mjs,cjs}',
        '**/routeTree.gen.ts',
        '**/paraglide/**',
      ],
    },
  },
});
