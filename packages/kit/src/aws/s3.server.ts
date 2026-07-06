import {
  CopyObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export { NoSuchKey, S3ServiceException, S3Client };

export function createS3Client(region: string): S3Client {
  return new S3Client({ region, requestChecksumCalculation: 'WHEN_REQUIRED' });
}

export type S3ObjectSummary = {
  key: string;
  size: number;
  lastModified?: Date;
};

export type GetObjectResult =
  | { kind: 'ok'; text: string; etag: string | undefined }
  | { kind: 'not-modified' };

export async function getObject(
  s3: S3Client,
  bucket: string,
  key: string,
  opts?: { ifNoneMatch?: string },
): Promise<GetObjectResult> {
  try {
    const out = await s3.send(new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ...(opts?.ifNoneMatch ? { IfNoneMatch: opts.ifNoneMatch } : {}),
    }));
    if (!out.Body) {
      throw new Error(`empty body for s3://${bucket}/${key}`);
    }
    const text = await out.Body.transformToString('utf-8');
    return {
      kind: 'ok',
      text,
      etag: out.ETag ?? undefined,
    };
  } catch (err) {
    if (isNotModified(err)) return { kind: 'not-modified' };
    throw err;
  }
}

export async function getObjectText(s3: S3Client, bucket: string, key: string): Promise<string> {
  const res = await getObject(s3, bucket, key);
  return (res as {
    kind: 'ok';
    text: string;
  }).text;
}

export type PutObjectInput = {
  bucket: string;
  key: string;
  body: Buffer | string;
  contentType?: string;
};

export async function putObject(
  s3: S3Client,
  input: PutObjectInput,
): Promise<{ etag: string | undefined }> {
  const out = await s3.send(new PutObjectCommand({
    Bucket: input.bucket,
    Key: input.key,
    Body: input.body,
    ContentType: input.contentType,
  }));
  return {
    etag: out.ETag ?? undefined,
  };
}

export async function listObjects(
  s3: S3Client,
  bucket: string,
  prefix: string,
): Promise<S3ObjectSummary[]> {
  const out: S3ObjectSummary[] = [];
  let continuationToken: string | undefined;
  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));
    for (const obj of res.Contents ?? []) {
      if (!obj.Key) {
        continue;
      }
      out.push({ key: obj.Key, size: obj.Size ?? 0, lastModified: obj.LastModified });
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);
  return out;
}

export async function listCommonPrefixes(
  s3: S3Client,
  bucket: string,
  prefix: string,
): Promise<string[]> {
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
      if (p.Prefix) {
        out.push(p.Prefix);
      }
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);
  return out;
}

export async function copyObject(
  s3: S3Client,
  bucket: string,
  sourceKey: string,
  destKey: string,
): Promise<void> {
  await s3.send(new CopyObjectCommand({
    Bucket: bucket,
    Key: destKey,
    CopySource: `${bucket}/${encodeURIComponent(sourceKey)}`,
  }));
}

export async function deletePrefix(
  s3: S3Client,
  bucket: string,
  prefix: string,
): Promise<number> {
  const objs = await listObjects(s3, bucket, prefix);
  if (objs.length === 0) {
    return 0;
  }
  return deleteObjects(s3, bucket, objs.map((o) => o.key));
}

export async function deleteObjects(
  s3: S3Client,
  bucket: string,
  keys: string[],
): Promise<number> {
  if (keys.length === 0) {
    return 0;
  }
  const BATCH = 1000;
  let deleted = 0;
  for (let i = 0; i < keys.length; i += BATCH) {
    const slice = keys.slice(i, i + BATCH);
    const res = await s3.send(new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: {
        Objects: slice.map((k) => ({ Key: k })),
        Quiet: true,
      },
    }));
    deleted += slice.length - (res.Errors?.length ?? 0);
    if (res.Errors && res.Errors.length > 0) {
      const first = res.Errors[0];
      throw new Error(`s3 deleteObjects partial failure: ${first?.Code}: ${first?.Message}`);
    }
  }
  return deleted;
}

export function presignPutObject(
  s3: S3Client,
  bucket: string,
  key: string,
  contentType: string,
  expiresIn: number,
): Promise<string> {
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
    { expiresIn },
  );
}

export function presignGetObject(
  s3: S3Client,
  bucket: string,
  key: string,
  expiresIn: number,
  disposition?: string,
): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket, Key: key, ResponseContentDisposition: disposition }),
    { expiresIn },
  );
}

export function parseS3Uri(uri: string): { bucket: string; key: string } {
  const rest = uri.slice('s3://'.length);
  const slash = rest.indexOf('/');
  return {
    bucket: rest.slice(0, slash),
    key: rest.slice(slash + 1),
  };
}

function isNotModified(err: unknown): boolean {
  if (!(err instanceof S3ServiceException)) {
    return false;
  }
  return err.$metadata?.httpStatusCode === 304 || err.name === 'NotModified';
}
