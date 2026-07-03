import { createFileRoute, redirect } from '@tanstack/react-router';

import { TENANT_SLUG } from '#/shared/env';

export const Route = createFileRoute('/')({
  beforeLoad: () => {
    throw redirect({
      to: '/o/$orgSlug',
      params: {
        orgSlug: TENANT_SLUG,
      },
    });
  },
});
