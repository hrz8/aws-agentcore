import { useBlocker, useNavigate, useParams } from '@tanstack/react-router';
import { GitBranch, Loader2 } from 'lucide-react';
import * as React from 'react';

import { m } from '#/paraglide/messages.js';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '#/components/ui/alert-dialog';
import { Badge } from '#/components/ui/badge';
import { Button } from '#/components/ui/button';
import { Card, CardContent } from '#/components/ui/card';
import { Input } from '#/components/ui/input';
import { Label } from '#/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '#/components/ui/select';
import { Switch } from '#/components/ui/switch';
import { cn } from '#/shared/utils';

import { useAgentVersions, useBranchAgentVersion, useSetLiveAgentVersion } from '../hooks';
import type { AgentIdentity } from '../types';

const VERSION_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,31}$/;

export function VersionList() {
  const versions = useAgentVersions();
  const branch = useBranchAgentVersion();
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { orgSlug?: string; agentId?: string };

  const liveVersion = versions.find((v) => v.enabled) ?? versions[0];
  const busy = branch.isPending;
  const busyRef = React.useRef(false);
  React.useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  const setLive = useSetLiveAgentVersion();
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [fromVersion, setFromVersion] = React.useState<string>('');
  const [toVersion, setToVersion] = React.useState('');
  const [enableImmediately, setEnableImmediately] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState<string | null>(null);
  const [liveConfirmTarget, setLiveConfirmTarget] = React.useState<AgentIdentity | null>(null);
  const [liveError, setLiveError] = React.useState<string | null>(null);
  const [liveSuccess, setLiveSuccess] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (dialogOpen && !fromVersion && liveVersion) {
      setFromVersion(liveVersion.version);
    }
  }, [dialogOpen, fromVersion, liveVersion]);

  useBlocker({
    shouldBlockFn: () => {
      if (!busyRef.current) return false;
      return !window.confirm(m.versions_branch_leave_confirm());
    },
    enableBeforeUnload: () => busyRef.current,
  });

  const trimmed = toVersion.trim();
  const versionExists = versions.some((v) => v.version === trimmed);
  const validFormat = VERSION_PATTERN.test(trimmed);
  const canSubmit =
    Boolean(fromVersion)
    && fromVersion !== trimmed
    && validFormat
    && !versionExists
    && !busy;

  async function handleConfirmSetLive() {
    if (!liveConfirmTarget) return;
    const target = liveConfirmTarget;
    setLiveError(null);
    setLiveSuccess(null);
    try {
      await setLive.mutateAsync({ toVersion: target.version });
      setLiveConfirmTarget(null);
      setLiveSuccess(m.versions_set_live_success({ toVersion: target.version }));
    } catch (err) {
      setLiveError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    busyRef.current = true;
    try {
      const res = await branch.mutateAsync({
        fromVersion,
        toVersion: trimmed,
        enabled: enableImmediately,
      });
      busyRef.current = false;
      setDialogOpen(false);
      setToVersion('');
      setEnableImmediately(false);
      setSuccessMsg(
        m.versions_branch_success({
          toVersion: res.target.version,
          webKbNote: res.kb.webKbNote,
        }),
      );
      if (params.orgSlug && params.agentId) {
        navigate({
          to: '/o/$orgSlug/agents/$agentId',
          params: { orgSlug: params.orgSlug, agentId: params.agentId },
          search: { v: res.target.version },
        });
      }
    } catch (err) {
      busyRef.current = false;
      setErrorMsg(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold tracking-tight">{m.versions_title()}</h2>
          <p className="text-sm text-muted-foreground">{m.versions_body()}</p>
        </div>
        <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <Button
            onClick={() => setDialogOpen(true)}
            disabled={versions.length === 0 || busy}
            size="sm"
          >
            <GitBranch className="mr-2 h-4 w-4" />
            {m.versions_branch_cta()}
          </Button>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{m.versions_branch_dialog_title()}</AlertDialogTitle>
              <AlertDialogDescription>
                {m.versions_branch_dialog_body()}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex flex-col gap-4 py-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="fromVersion">{m.versions_branch_from_label()}</Label>
                <Select
                  value={fromVersion}
                  onValueChange={setFromVersion}
                  disabled={busy || versions.length === 0}
                >
                  <SelectTrigger id="fromVersion">
                    <SelectValue placeholder="—" />
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
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="toVersion">{m.versions_branch_to_label()}</Label>
                <Input
                  id="toVersion"
                  autoFocus
                  spellCheck={false}
                  value={toVersion}
                  onChange={(e) => setToVersion(e.target.value)}
                  placeholder={m.versions_branch_to_placeholder()}
                  disabled={busy}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && canSubmit) handleSubmit();
                  }}
                />
                {trimmed && !validFormat ? (
                  <p className="text-xs text-destructive">
                    {m.versions_branch_to_hint()}
                  </p>
                ) : versionExists ? (
                  <p className="text-xs text-destructive">
                    {trimmed} already exists
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {m.versions_branch_to_hint()}
                  </p>
                )}
              </div>
              <div className="flex items-start gap-3">
                <Switch
                  id="enable"
                  checked={enableImmediately}
                  onCheckedChange={setEnableImmediately}
                  disabled={busy}
                />
                <div className="flex flex-col">
                  <Label htmlFor="enable" className="cursor-pointer">
                    {m.versions_branch_enable_label()}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {m.versions_branch_enable_hint()}
                  </p>
                </div>
              </div>
              {busy ? (
                <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                  <span className="min-w-0 break-words">
                    {m.versions_branch_in_progress({ toVersion: trimmed })}
                  </span>
                </div>
              ) : null}
              {errorMsg ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {m.versions_branch_error({ message: errorMsg })}
                </div>
              ) : null}
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={busy}>
                {m.versions_branch_cancel()}
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  void handleSubmit();
                }}
                disabled={!canSubmit}
              >
                {busy ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <GitBranch className="mr-2 h-4 w-4" />
                )}
                {m.versions_branch_submit()}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {successMsg ? (
        <div
          className={cn(
            'flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary',
          )}
        >
          <span className="min-w-0 break-words">{successMsg}</span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => setSuccessMsg(null)}
          >
            {m.common_close()}
          </Button>
        </div>
      ) : null}

      {liveSuccess ? (
        <div className="flex items-start gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm text-primary">
          <span className="min-w-0 break-words">{liveSuccess}</span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => setLiveSuccess(null)}
          >
            {m.common_close()}
          </Button>
        </div>
      ) : null}

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
                    <div className="flex items-center gap-2">
                      <code className="text-sm font-medium">{v.version}</code>
                      {v.enabled ? (
                        <Badge variant="default" className="h-4 px-1 text-[10px]">
                          {m.version_live_tag()}
                        </Badge>
                      ) : null}
                    </div>
                    {v.description ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">{v.description}</p>
                    ) : null}
                  </div>
                  <Switch
                    checked={v.enabled}
                    disabled={v.enabled || setLive.isPending}
                    onCheckedChange={(next) => {
                      if (next && !v.enabled) setLiveConfirmTarget(v);
                    }}
                    aria-label={
                      v.enabled ? m.versions_live_aria() : m.versions_set_live_aria()
                    }
                  />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <AlertDialog
        open={liveConfirmTarget !== null}
        onOpenChange={(open) => {
          if (!open && !setLive.isPending) {
            setLiveConfirmTarget(null);
            setLiveError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {liveConfirmTarget
                ? m.versions_set_live_title({ toVersion: liveConfirmTarget.version })
                : ''}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {liveConfirmTarget
                ? m.versions_set_live_body({
                    toVersion: liveConfirmTarget.version,
                    currentVersion: liveVersion?.version ?? '—',
                  })
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {liveError ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {m.versions_set_live_error({ message: liveError })}
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={setLive.isPending}>
              {m.versions_set_live_cancel()}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleConfirmSetLive();
              }}
              disabled={setLive.isPending}
            >
              {setLive.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {m.versions_set_live_confirm()}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
