import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

import { AWS_REGION } from '../../../config.js';

const client = new S3Client({ region: AWS_REGION, requestChecksumCalculation: 'WHEN_REQUIRED' });

export function presignPutObject(
  bucket: string,
  key: string,
  contentType: string,
  expiresIn: number,
): Promise<string> {
  return getSignedUrl(client, new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  }), { expiresIn });
}

export function presignGetObject(
  bucket: string,
  key: string,
  expiresIn: number,
  responseContentDisposition?: string,
): Promise<string> {
  return getSignedUrl(client, new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentDisposition: responseContentDisposition,
  }), { expiresIn });
}

export function parseS3Uri(uri: string): { bucket: string; key: string } {
  const rest = uri.slice('s3://'.length);
  const slash = rest.indexOf('/');
  return { bucket: rest.slice(0, slash), key: rest.slice(slash + 1) };
}
