import { useNavigate, useParams } from '@tanstack/react-router';

import { useTenants } from '#/features/agents';
import { m } from '#/paraglide/messages.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select';

export function TenantSelector() {
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { orgSlug?: string };
  const tenants = useTenants();
  const active = params.orgSlug ?? '';
  const rows = tenants.data?.tenants ?? [];

  return (
    <Select
      value={active}
      onValueChange={(nextSlug) => {
        if (!nextSlug || nextSlug === active) return;
        navigate({
          to: '/o/$orgSlug',
          params: { orgSlug: nextSlug },
        });
      }}
    >
      <SelectTrigger className="h-8 w-48 gap-2">
        <span className="inline-block h-4 w-4 shrink-0 rounded-sm bg-primary" />
        <SelectValue placeholder={m.tenant_selector_placeholder()} />
      </SelectTrigger>
      <SelectContent>
        {tenants.isLoading ? (
          <SelectItem value="__loading" disabled>
            {m.tenant_selector_loading()}
          </SelectItem>
        ) : rows.length === 0 ? (
          <SelectItem value="__empty" disabled>
            {m.tenant_selector_empty()}
          </SelectItem>
        ) : (
          rows.map((t) => (
            <SelectItem key={t.tenantSlug} value={t.tenantSlug}>
              {t.tenantName}
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
