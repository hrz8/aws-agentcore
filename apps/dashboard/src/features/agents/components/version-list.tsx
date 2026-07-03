import { m } from '#/paraglide/messages.js';
import { Card, CardContent } from '#/components/ui/card';
import { Switch } from '#/components/ui/switch';

import { useAgentVersions } from '../hooks';

export function VersionList() {
  const versions = useAgentVersions();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold tracking-tight">{m.versions_title()}</h2>
        <p className="text-sm text-muted-foreground">{m.versions_body()}</p>
      </div>

      {versions.length === 0 ? (
        <Card>
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">{m.versions_loading()}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {versions.map((v) => (
            <li key={v.version}>
              <Card>
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <code className="text-sm font-medium">{v.version}</code>
                    {v.description ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{v.description}</p>
                    ) : null}
                  </div>
                  <Switch
                    checked={v.enabled}
                    disabled
                    aria-label={v.enabled ? m.versions_live_aria() : m.versions_draft_aria()}
                  />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
