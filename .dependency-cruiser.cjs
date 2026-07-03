/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies are forbidden anywhere in the workspace.',
      from: {},
      to: { circular: true },
    },
    {
      name: 'no-context-crosstalk',
      severity: 'error',
      comment:
        'Bounded-context packages (@repo/registry, @repo/kb, @repo/skills) must NOT import each other. ' +
        'Cross-context orchestration lives in apps (the BFF layer composes contexts).',
      from: { path: '^packages/(registry|kb|skills)/' },
      to: {
        path: '^packages/(registry|kb|skills)/',
        pathNot: '^packages/$1/',
      },
    },
    {
      name: 'no-app-in-package',
      severity: 'error',
      comment: 'Packages must not import from apps. Dependency direction is app → package.',
      from: { path: '^packages/' },
      to: { path: '^apps/' },
    },
    {
      name: 'no-server-only-in-frontend',
      severity: 'error',
      comment:
        'apps/frontend runs in the browser and must not TRANSITIVELY reach any ' +
        'server-only @repo/kit subpath (aws/*, logger.server, request-context.server). ' +
        'reachable:true catches indirect chains like frontend → @repo/kb → @repo/kit/aws/s3. ' +
        'Bundle-safe subpaths (identity, http, logger, paths) remain allowed.',
      from: { path: '^apps/frontend/' },
      to: {
        path: '^packages/kit/src/(aws/|logger\\.server|request-context\\.server|http\\.server)',
        reachable: true,
      },
    },
    {
      name: 'kit-is-leaf',
      severity: 'error',
      comment: '@repo/kit is the leaf layer and must not depend on any bounded-context package.',
      from: { path: '^packages/kit/' },
      to: { path: '^packages/(registry|kb|skills)/' },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    tsConfig: {
      // Shim tsconfig at repo root — declares only the workspace-scoped path
      // aliases used across the monorepo (only apps/dashboard has any today).
      // Without this, `#/*` imports are invisible to dep-cruiser, giving
      // no-circular and reachability checks a blindspot in the dashboard tree.
      fileName: 'tsconfig.dep-cruiser.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main'],
    },
    includeOnly: '^(apps|packages)/',
    exclude: {
      path: [
        'node_modules',
        'dist',
        '\\.turbo',
        '\\.output',
        '\\.playwright-mcp',
        'routeTree\\.gen\\.ts$',
        '(^|/)paraglide/',
      ],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
