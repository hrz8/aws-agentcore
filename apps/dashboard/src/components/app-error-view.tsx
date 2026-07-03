import { m } from '#/paraglide/messages.js';

export function AppErrorView({ error }: { error: unknown }) {
  const info = extractErrorInfo(error);
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-2 text-sm">
      <p className="font-medium text-destructive">{info.message}</p>
      <div className="font-mono text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
        <span>
          {m.error_view_code_label()}: {info.code}
        </span>
        {info.httpStatus != null ? (
          <span>
            {m.error_view_http_label()}: {info.httpStatus}
          </span>
        ) : null}
      </div>
    </div>
  );
}

type ErrorInfo = {
  code: string;
  message: string;
  httpStatus?: number;
};

function extractErrorInfo(error: unknown): ErrorInfo {
  if (error instanceof Error) {
    const httpStatus = (error as unknown as { status?: unknown }).status;
    return {
      code: error.name || 'Error',
      message: error.message || String(error),
      httpStatus: typeof httpStatus === 'number' ? httpStatus : undefined,
    };
  }
  return {
    code: 'Unknown',
    message: String(error),
  };
}
