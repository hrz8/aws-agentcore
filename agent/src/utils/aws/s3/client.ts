import {
  GetObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';

import { AWS_REGION } from '../../../config.js';

export const s3 = new S3Client({
  region: AWS_REGION,
  requestChecksumCalculation: 'WHEN_REQUIRED',
});

export async function getObjectText(bucket: string, key: string): Promise<string> {
  const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!out.Body) throw new Error(`empty body for s3://${bucket}/${key}`);
  return out.Body.transformToString('utf-8');
}

export async function listCommonPrefixes(bucket: string, prefix: string): Promise<string[]> {
  const out: string[] = [];
  let continuationToken: string | undefined;
  do {
    const res = await s3.send(new ListObjectsV2Command({
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

export type S3ObjectSummary = { key: string; size: number };

export async function listObjects(bucket: string, prefix: string): Promise<S3ObjectSummary[]> {
  const out: S3ObjectSummary[] = [];
  let continuationToken: string | undefined;
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    for (const obj of res.Contents ?? []) {
      if (!obj.Key) continue;
      out.push({ key: obj.Key, size: obj.Size ?? 0 });
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);
  return out;
}
