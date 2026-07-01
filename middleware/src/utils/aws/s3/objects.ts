import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

import { AWS_REGION } from '../../../config.js';

const client = new S3Client({ region: AWS_REGION, requestChecksumCalculation: 'WHEN_REQUIRED' });

export type PutObjectInput = {
  bucket: string;
  key: string;
  body: Buffer | string;
  contentType?: string;
};

export async function putObject(input: PutObjectInput): Promise<void> {
  await client.send(new PutObjectCommand({
    Bucket: input.bucket,
    Key: input.key,
    Body: input.body,
    ContentType: input.contentType,
  }));
}

export async function getObjectText(bucket: string, key: string): Promise<string> {
  const out = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!out.Body) throw new Error(`empty body for s3://${bucket}/${key}`);
  return out.Body.transformToString('utf-8');
}

export type S3ObjectSummary = {
  key: string;
  size: number;
  lastModified?: Date;
};

export async function listObjects(bucket: string, prefix: string): Promise<S3ObjectSummary[]> {
  const out: S3ObjectSummary[] = [];
  let continuationToken: string | undefined;
  do {
    const res = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    for (const obj of res.Contents ?? []) {
      if (!obj.Key) continue;
      out.push({ key: obj.Key, size: obj.Size ?? 0, lastModified: obj.LastModified });
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);
  return out;
}

export async function listCommonPrefixes(bucket: string, prefix: string): Promise<string[]> {
  const out: string[] = [];
  let continuationToken: string | undefined;
  do {
    const res = await client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      Delimiter: '/',
      ContinuationToken: continuationToken,
    }));
    for (const p of res.CommonPrefixes ?? []) {
      if (p.Prefix) out.push(p.Prefix);
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);
  return out;
}

// Hard delete — no soft delete / versioning.
export async function deletePrefix(bucket: string, prefix: string): Promise<number> {
  const objs = await listObjects(bucket, prefix);
  if (objs.length === 0) return 0;
  const BATCH = 1000; // DeleteObjects hard limit.
  let deleted = 0;
  for (let i = 0; i < objs.length; i += BATCH) {
    const slice = objs.slice(i, i + BATCH);
    const res = await client.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: slice.map(o => ({ Key: o.key })), Quiet: true },
    }));
    deleted += slice.length - (res.Errors?.length ?? 0);
    if (res.Errors && res.Errors.length > 0) {
      const first = res.Errors[0];
      throw new Error(`s3 deleteObjects partial failure: ${first?.Code}: ${first?.Message}`);
    }
  }
  return deleted;
}
