import { CfnOutput, RemovalPolicy, Stack } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

import { Stages, type Stage } from '../config.js';
import { validateSlug } from '../helpers.js';

export const SLUG_REGEX = /^[a-z][a-z0-9-]{0,28}[a-z0-9]$/;

export type UploadsBucketProps = {
  readonly namePrefix: string;
  readonly stage: Stage;
  readonly corsOrigins?: string[];
};

export class UploadsBucket extends Construct {
  readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: UploadsBucketProps) {
    super(scope, id);

    validateSlug('namePrefix', props.namePrefix, SLUG_REGEX);

    const stack = Stack.of(this);
    const isProd = props.stage === Stages.Prod;
    const stageLower = props.stage.toLowerCase();
    const accountId = stack.account;

    const bucketName = `${props.namePrefix}-${stageLower}-${accountId}`;
    // accountId is a CDK token at synth time, so length() on the assembled
    // name lies — check the literal prefix and reserve 12 for the account.
    const literalLen = `${props.namePrefix}-${stageLower}-`.length;
    if (literalLen + 12 > 63) {
      throw new Error(
        `Bucket name would exceed 63 chars: literal prefix ${literalLen} + 12 (account id) > 63. namePrefix '${props.namePrefix}' too long.`,
      );
    }

    this.bucket = new s3.Bucket(this, 'Bucket', {
      bucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      versioned: isProd,
      encryption: s3.BucketEncryption.S3_MANAGED,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
      cors: [{
        allowedMethods: [s3.HttpMethods.PUT, s3.HttpMethods.GET, s3.HttpMethods.HEAD],
        allowedOrigins: props.corsOrigins ?? ['*'],
        allowedHeaders: ['*'],
        exposedHeaders: ['ETag'],
        maxAge: 3000,
      }],
    });

    new CfnOutput(stack, `${id}Name`, {
      value: this.bucket.bucketName,
      description: `Uploads S3 bucket name (${id})`,
    });
  }
}
