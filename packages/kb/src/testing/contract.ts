import { describe, expect, it } from 'vitest';

import type { Scope } from '@repo/kit/identity';

import { IngestStatus } from '../domain/types.js';
import {
  KbConflictError,
  KbNotConfiguredError,
  KbNotFoundError,
  KbScopeError,
  KbValidationError,
} from '../errors.js';
import type { KbRepository } from '../interface.js';

export type KbContractOptions = {
  makeUnconfiguredWebRepo?: () => KbRepository;
  bucket: string;
};

export function runKbContract(
  adapterName: string,
  makeRepo: () => KbRepository,
  opts: KbContractOptions,
): void {
  const scope: Scope = {
    tenantId: '00000000-0000-4000-8000-000000000001',
    agentId: '00000000-0000-4000-8000-000000000002',
    version: '1.0.0',
  };

  const inScopeUri = `s3://${opts.bucket}/kb/${scope.tenantId}/${scope.agentId}/${scope.version}/doc.pdf`;

  describe(`KbRepository contract [${adapterName}]`, () => {
    it('presignUpload returns URLs + sidecar body', async () => {
      const repo = makeRepo();
      const ticket = await repo.presignUpload(scope, {
        filename: 'doc.pdf',
        contentType: 'application/pdf',
      });
      expect(ticket.fileUploadUrl).toBeTruthy();
      expect(ticket.sidecarUploadUrl).toBeTruthy();
      expect(ticket.sidecarBody.metadataAttributes).toEqual({
        tenant_id: scope.tenantId,
        agent_id: scope.agentId,
        agent_version: scope.version,
      });
      expect(ticket.expiresIn).toBeGreaterThan(0);
    });

    it('presignUpload rejects invalid filename with KbValidationError', async () => {
      const repo = makeRepo();
      await expect(
        repo.presignUpload(scope, { filename: '', contentType: 'application/pdf' }),
      ).rejects.toBeInstanceOf(KbValidationError);
    });

    it('listDocuments returns [] on empty scope', async () => {
      const repo = makeRepo();
      expect(await repo.listDocuments(scope)).toEqual([]);
    });

    it('listDocuments returns uploaded files', async () => {
      const repo = makeRepo();
      await repo.presignUpload(scope, { filename: 'a.pdf', contentType: 'application/pdf' });
      await repo.presignUpload(scope, { filename: 'b.md', contentType: 'text/markdown' });
      const docs = await repo.listDocuments(scope);
      expect(docs).toHaveLength(2);
      expect(docs.map((d) => d.filename).sort()).toEqual(['a.pdf', 'b.md'].sort());
    });

    it('startIngestion returns a job with an id', async () => {
      const repo = makeRepo();
      const job = await repo.startIngestion(scope);
      expect(job.ingestionJobId).toBeTruthy();
    });

    it('getIngestionJob returns the previously-started job', async () => {
      const repo = makeRepo();
      const started = await repo.startIngestion(scope);
      const fetched = await repo.getIngestionJob(scope, started.ingestionJobId!);
      expect(fetched.ingestionJobId).toBe(started.ingestionJobId);
    });

    it('getIngestionJob throws KbNotFoundError for unknown id', async () => {
      const repo = makeRepo();
      await expect(repo.getIngestionJob(scope, 'nope-does-not-exist')).rejects.toBeInstanceOf(
        KbNotFoundError,
      );
    });

    it('ingestWebDocument returns a scoped documentId', async () => {
      const repo = makeRepo();
      const doc = await repo.ingestWebDocument(scope, {
        text: 'hello world',
        contentHash: 'abc123',
        sourceUrl: 'https://example.com/page',
        title: 'Example',
        fetchedAt: new Date().toISOString(),
      });
      expect(doc.documentId).toContain(scope.tenantId);
      expect(doc.documentId).toContain(scope.agentId);
      expect(doc.documentId).toContain(scope.version);
      expect(doc.documentId).toContain('abc123');
    });

    it('listWebDocuments returns [] on empty scope, then ingested docs', async () => {
      const repo = makeRepo();
      expect(await repo.listWebDocuments(scope)).toEqual([]);
      await repo.ingestWebDocument(scope, {
        text: 'a',
        contentHash: 'h1',
        sourceUrl: 'https://a',
        title: 't',
        fetchedAt: 'now',
      });
      const docs = await repo.listWebDocuments(scope);
      expect(docs).toHaveLength(1);
    });

    it('deleteWebDocument rejects a foreign scope docId with KbScopeError', async () => {
      const repo = makeRepo();
      await expect(
        repo.deleteWebDocument(scope, 'other__tenant__agent__ver__hash'),
      ).rejects.toBeInstanceOf(KbScopeError);
    });

    it('deleteWebDocument rejects a prefix-confusion docId', async () => {
      const repo = makeRepo();
      await expect(
        repo.deleteWebDocument(scope, `${scope.tenantId}FAKE__${scope.agentId}__${scope.version}__h`),
      ).rejects.toBeInstanceOf(KbScopeError);
    });

    it('deleteWebDocument throws KbNotFoundError for unknown but in-scope docId', async () => {
      const repo = makeRepo();
      const inScopeUnknown = `${scope.tenantId}__${scope.agentId}__${scope.version}__missinghash`;
      await expect(repo.deleteWebDocument(scope, inScopeUnknown)).rejects.toBeInstanceOf(
        KbNotFoundError,
      );
    });

    it('deleteWebDocument removes an ingested doc', async () => {
      const repo = makeRepo();
      const created = await repo.ingestWebDocument(scope, {
        text: 'a',
        contentHash: 'h1',
        sourceUrl: 'https://a',
        title: 't',
        fetchedAt: 'now',
      });
      await repo.deleteWebDocument(scope, created.documentId);
      expect(await repo.listWebDocuments(scope)).toHaveLength(0);
    });

    it('branch rejects same source and target version with KbValidationError', async () => {
      const repo = makeRepo();
      await repo.presignUpload(scope, { filename: 'a.md', contentType: 'text/markdown' });
      await expect(repo.branch(scope, { toVersion: scope.version })).rejects.toBeInstanceOf(
        KbValidationError,
      );
    });

    it('branch rejects empty source with KbValidationError', async () => {
      const repo = makeRepo();
      await expect(repo.branch(scope, { toVersion: '2.0.0' })).rejects.toBeInstanceOf(
        KbValidationError,
      );
    });

    it('branch copies files to a new version prefix', async () => {
      const repo = makeRepo();
      await repo.presignUpload(scope, { filename: 'a.md', contentType: 'text/markdown' });
      await repo.presignUpload(scope, { filename: 'b.pdf', contentType: 'application/pdf' });
      const outcome = await repo.branch(scope, { toVersion: '2.0.0' });
      expect(outcome.filesCopied).toBeGreaterThan(0);
      expect(outcome.sourceVersion).toBe(scope.version);
      expect(outcome.targetVersion).toBe('2.0.0');
      const listed = await repo.listDocuments({ ...scope, version: '2.0.0' });
      expect(listed).toHaveLength(2);
    });

    it('branch with sync !== false returns a non-null ingestionJob', async () => {
      const repo = makeRepo();
      await repo.presignUpload(scope, { filename: 'a.md', contentType: 'text/markdown' });
      const outcome = await repo.branch(scope, { toVersion: '2.0.0' });
      expect(outcome.ingestionJob).not.toBeNull();
    });

    it('branch with sync === false skips ingestion trigger', async () => {
      const repo = makeRepo();
      await repo.presignUpload(scope, { filename: 'a.md', contentType: 'text/markdown' });
      const outcome = await repo.branch(scope, { toVersion: '2.0.0', sync: false });
      expect(outcome.ingestionJob).toBeNull();
    });

    it('branch rejects non-empty target with KbConflictError', async () => {
      const repo = makeRepo();
      await repo.presignUpload(scope, { filename: 'a.md', contentType: 'text/markdown' });
      const targetScope: Scope = { ...scope, version: '2.0.0' };
      await repo.presignUpload(targetScope, {
        filename: 'existing.md',
        contentType: 'text/markdown',
      });
      await expect(repo.branch(scope, { toVersion: '2.0.0' })).rejects.toBeInstanceOf(
        KbConflictError,
      );
    });

    it('presignDownload rejects non-s3 uri with KbValidationError', async () => {
      const repo = makeRepo();
      await expect(
        repo.presignDownload(scope, { uri: 'https://example.com/file.pdf' }),
      ).rejects.toBeInstanceOf(KbValidationError);
    });

    it('presignDownload rejects out-of-scope s3 uri with KbScopeError', async () => {
      const repo = makeRepo();
      await expect(
        repo.presignDownload(scope, {
          uri: `s3://${opts.bucket}/kb/other-tenant/agent/version/x.pdf`,
        }),
      ).rejects.toBeInstanceOf(KbScopeError);
    });

    it('presignDownload rejects prefix-confusion uri with KbScopeError', async () => {
      const repo = makeRepo();
      await expect(
        repo.presignDownload(scope, {
          uri: `s3://${opts.bucket}/kb/${scope.tenantId}EXTRA/${scope.agentId}/${scope.version}/x.pdf`,
        }),
      ).rejects.toBeInstanceOf(KbScopeError);
    });

    it('presignDownload happy path with in-scope uri', async () => {
      const repo = makeRepo();
      const signed = await repo.presignDownload(scope, { uri: inScopeUri });
      expect(signed.url).toBeTruthy();
      expect(signed.expiresIn).toBeGreaterThan(0);
    });

    it('IngestStatus enum values match adapter output', async () => {
      const repo = makeRepo();
      const doc = await repo.ingestWebDocument(scope, {
        text: 'x',
        contentHash: 'h',
        sourceUrl: 'u',
        title: 't',
        fetchedAt: 'now',
      });
      if (doc.status !== undefined) {
        expect(Object.values(IngestStatus)).toContain(doc.status);
      }
    });
  });

  if (opts.makeUnconfiguredWebRepo) {
    const makeUnc = opts.makeUnconfiguredWebRepo;
    describe(`KbRepository contract — unconfigured web DS [${adapterName}]`, () => {
      it('ingestWebDocument throws KbNotConfiguredError', async () => {
        const repo = makeUnc();
        await expect(
          repo.ingestWebDocument(scope, {
            text: 'x',
            contentHash: 'h',
            sourceUrl: 'u',
            title: 't',
            fetchedAt: 'now',
          }),
        ).rejects.toBeInstanceOf(KbNotConfiguredError);
      });

      it('listWebDocuments throws KbNotConfiguredError', async () => {
        const repo = makeUnc();
        await expect(repo.listWebDocuments(scope)).rejects.toBeInstanceOf(
          KbNotConfiguredError,
        );
      });

      it('deleteWebDocument throws KbNotConfiguredError', async () => {
        const repo = makeUnc();
        const validDocId = `${scope.tenantId}__${scope.agentId}__${scope.version}__h`;
        await expect(repo.deleteWebDocument(scope, validDocId)).rejects.toBeInstanceOf(
          KbNotConfiguredError,
        );
      });
    });
  }
}
