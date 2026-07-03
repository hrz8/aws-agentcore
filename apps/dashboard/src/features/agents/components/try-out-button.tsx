import { ExternalLink, MessageSquare } from 'lucide-react';
import * as React from 'react';

import { m } from '#/paraglide/messages.js';
import { Button } from '#/components/ui/button';
import { FRONTEND_URL } from '#/shared/env';

import { useCurrentScope } from '../hooks';

export function TryOutButton() {
  const scope = useCurrentScope();

  const href = React.useMemo(() => {
    if (!scope) return null;
    const params = new URLSearchParams({
      tenant: scope.tenantId,
      agent: scope.agentId,
      version: scope.agentVersion,
    });
    return `${FRONTEND_URL}/?${params.toString()}`;
  }, [scope]);

  if (!href) {
    return (
      <Button disabled variant="outline" size="sm">
        <MessageSquare className="mr-2 h-4 w-4" />
        {m.try_out_label()}
      </Button>
    );
  }

  return (
    <Button asChild variant="outline" size="sm">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={m.try_out_title()}
      >
        <MessageSquare className="mr-2 h-4 w-4" />
        {m.try_out_label()}
        <ExternalLink className="ml-1.5 h-3 w-3 opacity-60" />
      </a>
    </Button>
  );
}
