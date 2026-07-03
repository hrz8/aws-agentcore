import { Loader2, Upload } from 'lucide-react';
import * as React from 'react';

import { m } from '#/paraglide/messages.js';
import { Button } from '#/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '#/components/ui/card';

import { useUploadSkill } from '../hooks';

export function SkillUploader() {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const upload = useUploadSkill();
  const [status, setStatus] = React.useState<
    { kind: 'ok'; text: string } | { kind: 'err'; text: string } | null
  >(null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{m.skills_upload_title()}</CardTitle>
        <CardDescription>{m.skills_upload_body()}</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept=".md,.zip"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (!file) return;
            upload.mutate(file, {
              onSuccess: (res) => {
                setStatus({
                  kind: 'ok',
                  text: m.skills_upload_ok({ name: res.name, resourcesNote: '' }),
                });
              },
              onError: (err) =>
                setStatus({
                  kind: 'err',
                  text: err instanceof Error ? err.message : String(err),
                }),
            });
          }}
        />
        <Button onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
          {upload.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Upload className="mr-2 h-4 w-4" />
          )}
          {m.skills_upload_cta()}
        </Button>
        {status ? (
          <span
            className={status.kind === 'ok' ? 'text-sm text-primary' : 'text-sm text-destructive'}
          >
            {status.text}
          </span>
        ) : null}
      </CardContent>
    </Card>
  );
}
