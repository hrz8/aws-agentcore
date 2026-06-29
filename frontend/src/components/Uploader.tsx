import { useRef, useState } from 'react';
import {
  getIngestionJob,
  presignUpload,
  putToS3,
  startIngestion,
  type IngestionJobStatus,
} from '../lib/kbApi';

type Status =
  | { kind: 'idle' }
  | { kind: 'uploading'; filename: string }
  | { kind: 'ingesting'; jobId: string; jobStatus: IngestionJobStatus | 'STARTING' }
  | { kind: 'done'; filename: string }
  | { kind: 'error'; message: string };

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 5 * 60_000;

export function Uploader(): React.ReactElement {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const onPick = (): void => inputRef.current?.click();

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await runUpload(file);
  };

  async function runUpload(file: File): Promise<void> {
    setStatus({ kind: 'uploading', filename: file.name });
    try {
      const presign = await presignUpload(file.name, file.type || 'application/octet-stream');
      await Promise.all([
        putToS3(presign.fileUploadUrl, file, file.type || 'application/octet-stream'),
        putToS3(presign.sidecarUploadUrl, JSON.stringify(presign.sidecarBody), 'application/json'),
      ]);
      const job = await startIngestion();
      setStatus({ kind: 'ingesting', jobId: job.ingestionJobId, jobStatus: 'STARTING' });
      const final = await pollIngestion(job.ingestionJobId, s =>
        setStatus({ kind: 'ingesting', jobId: job.ingestionJobId, jobStatus: s }));
      if (final === 'COMPLETE') {
        setStatus({ kind: 'done', filename: file.name });
      } else {
        setStatus({ kind: 'error', message: `ingestion ${final}` });
      }
    } catch (err) {
      setStatus({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <div className="uploader">
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.md,.txt,.docx,.html,.htm"
        style={{ display: 'none' }}
        onChange={onFile}
      />
      <button
        type="button"
        onClick={onPick}
        disabled={status.kind === 'uploading' || status.kind === 'ingesting'}
      >
        upload document
      </button>
      <StatusLine status={status} />
    </div>
  );
}

function StatusLine({ status }: { status: Status }): React.ReactElement | null {
  switch (status.kind) {
    case 'idle':       return null;
    case 'uploading':  return <span className="uploader__status">⏫ uploading {status.filename}…</span>;
    case 'ingesting':  return <span className="uploader__status">📥 ingesting ({status.jobStatus})…</span>;
    case 'done':       return <span className="uploader__status uploader__status--ok">✓ ingested {status.filename}</span>;
    case 'error':      return <span className="uploader__status uploader__status--err">⚠ {status.message}</span>;
  }
}

async function pollIngestion(
  jobId: string,
  onUpdate: (s: IngestionJobStatus) => void,
): Promise<IngestionJobStatus> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  for (;;) {
    if (Date.now() > deadline) throw new Error('ingestion poll timed out');
    const info = await getIngestionJob(jobId);
    onUpdate(info.status);
    if (info.status === 'COMPLETE' || info.status === 'FAILED' || info.status === 'STOPPED') {
      return info.status;
    }
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}
