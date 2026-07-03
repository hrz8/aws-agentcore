import { useNavigate, useParams } from '@tanstack/react-router';

import { m } from '#/paraglide/messages.js';
import { Badge } from '#/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select';

import { useAgentVersions, useCurrentScope } from '../hooks';

export function VersionSelector() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { agentId?: string };
  const versions = useAgentVersions();
  const scope = useCurrentScope();
  const active = scope?.agentVersion ?? '';
  const liveVersion = versions.find((v) => v.enabled)?.version;

  if (!params.agentId || versions.length === 0) return null;

  return (
    <Select
      value={active}
      onValueChange={(next) => {
        navigate({
          to: '.',
          search: (prev) => ({
            ...(prev as Record<string, unknown>),
            v: next === liveVersion ? undefined : next,
          }),
        });
      }}
    >
      <SelectTrigger className="h-8 w-32">
        <SelectValue placeholder={m.version_selector_placeholder()} />
      </SelectTrigger>
      <SelectContent>
        {versions.map((v) => (
          <SelectItem key={v.version} value={v.version}>
            <span className="flex items-center gap-2">
              <span>{v.version}</span>
              {v.enabled ? (
                <Badge variant="default" className="h-4 px-1 text-[10px]">
                  {m.version_live_tag()}
                </Badge>
              ) : null}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
