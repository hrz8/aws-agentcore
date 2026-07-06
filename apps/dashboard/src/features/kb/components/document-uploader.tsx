import { useQueryClient } from '@tanstack/react-query';
import { useBlocker } from '@tanstack/react-router';
import { Loader2, Upload } from 'lucide-react';
import * as React from 'react';

import { useCurrentScope } from '#/features/agents';
import { m } from '#/paraglide/messages.js';
import { Button } from '#/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card';

import { pollIngestion, putToS3, usePresignUpload, useStartIngestion } from '../hooks';
import { kbQueries } from '../queries';
import { IngestionJobStatus } from '../types';

const UploadStateKind = {
  Idle: 'idle',
  Uploading: 'uploading',
  Ingesting: 'ingesting',
  Done: 'done',
  Error: 'error',
} as const;
type UploadStateKind = typeof UploadStateKind[keyof typeof UploadStateKind];

type UploadState =
  | { kind: typeof UploadStateKind.Idle }
  | { kind: typeof UploadStateKind.Uploading; filename: string }
  | { kind: typeof UploadStateKind.Ingesting; jobId: string; jobStatus: IngestionJobStatus }
  | { kind: typeof UploadStateKind.Done; filename: string }
  | { kind: typeof UploadStateKind.Error; message: string };

export function DocumentUploader() {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [state, setState] = React.useState<UploadState>({ kind: UploadStateKind.Idle });
  const scope = useCurrentScope();
  const qc = useQueryClient();
  const presign = usePresignUpload();
  const startIngestion = useStartIngestion();

  const busy =
    state.kind === UploadStateKind.Uploading || state.kind === UploadStateKind.Ingesting;

  useBlocker({
    shouldBlockFn: () => {
      if (!busy) return false;
      return !window.confirm(m.kb_upload_leave_confirm());
    },
    enableBeforeUnload: () => busy,
  });

  async function runUpload(file: File) {
    setState({ kind: UploadStateKind.Uploading, filename: file.name });
    try {
      const contentType = file.type || 'application/octet-stream';
      const p = await presign.mutateAsync({ filename: file.name, contentType });
      await Promise.all([
        putToS3(p.fileUploadUrl, file, contentType),
        putToS3(p.sidecarUploadUrl, JSON.stringify(p.sidecarBody), 'application/json'),
      ]);
      qc.invalidateQueries({ queryKey: kbQueries.all });
      const job = await startIngestion.mutateAsync();
      const jobId = job.ingestionJobId;
      if (!jobId) {
        throw new Error('ingestion job started with no id');
      }
      if (!scope) {
        throw new Error('no agent scope resolved');
      }
      setState({
        kind: UploadStateKind.Ingesting,
        jobId,
        jobStatus: IngestionJobStatus.Starting,
      });
      const final = await pollIngestion(scope, jobId, (s) =>
        setState({ kind: UploadStateKind.Ingesting, jobId, jobStatus: s }),
      );
      if (final === IngestionJobStatus.Complete) {
        setState({ kind: UploadStateKind.Done, filename: file.name });
      } else {
        setState({ kind: UploadStateKind.Error, message: `ingestion ${final}` });
      }
    } catch (err) {
      setState({
        kind: UploadStateKind.Error,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.kb_upload_title()}</CardTitle>
        <CardDescription>{m.kb_upload_body()}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.md,.txt,.docx,.html,.htm"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) void runUpload(file);
          }}
        />
        <Button onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
          {m.kb_upload_cta()}
        </Button>
        <StatusLine state={state} />
      </CardContent>
    </Card>
  );
}

function StatusLine({ state }: { state: UploadState }) {
  switch (state.kind) {
    case UploadStateKind.Idle:
      return null;
    case UploadStateKind.Uploading:
      return (
        <span className="text-sm text-muted-foreground">
          {m.kb_upload_status_uploading({ filename: state.filename })}
        </span>
      );
    case UploadStateKind.Ingesting:
      return (
        <span className="text-sm text-muted-foreground">
          {m.kb_upload_status_ingesting({ status: state.jobStatus })}
        </span>
      );
    case UploadStateKind.Done:
      return (
        <span className="text-sm text-primary">
          {m.kb_upload_status_done({ filename: state.filename })}
        </span>
      );
    case UploadStateKind.Error:
      return (
        <span className="text-sm text-destructive">
          {m.kb_upload_status_failed({ message: state.message })}
        </span>
      );
  }
}
