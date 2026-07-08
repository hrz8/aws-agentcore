import { CfnOutput, RemovalPolicy, Stack } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

import { Stages, type Stage } from '../config.js';

export type PublicAssetsBucketProps = {
  readonly namePrefix: string;
  readonly stage: Stage;
};

export class PublicAssetsBucket extends Construct {
  readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: PublicAssetsBucketProps) {
    super(scope, id);

    const stack = Stack.of(this);
    const isProd = props.stage === Stages.Prod;
    const stageLower = props.stage.toLowerCase();
    const exportPrefix = `${props.stage}-${props.namePrefix}`;

    this.bucket = new s3.Bucket(this, 'Bucket', {
      bucketName: `${props.namePrefix}-files-${stageLower}-${stack.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: isProd,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
      cors: [{
        allowedMethods: [s3.HttpMethods.GET, s3.HttpMethods.HEAD],
        allowedOrigins: ['*'],
        allowedHeaders: ['*'],
        maxAge: 86400,
      }],
    });

    new CfnOutput(this, 'Name', {
      value: this.bucket.bucketName,
      description: 'Public assets S3 bucket name',
      exportName: `${exportPrefix}-PublicAssetsBucketName`,
    });
  }
}
