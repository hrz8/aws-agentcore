import { CfnOutput, RemovalPolicy, Stack } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

import { Stages, type Stage } from '../config.js';

export type WebsiteBucketProps = {
  readonly namePrefix: string;
  readonly stage: Stage;
};

export class WebsiteBucket extends Construct {
  readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: WebsiteBucketProps) {
    super(scope, id);

    const stack = Stack.of(this);
    const isProd = props.stage === Stages.Prod;
    const stageLower = props.stage.toLowerCase();
    const exportPrefix = `${props.stage}-${props.namePrefix}`;

    this.bucket = new s3.Bucket(this, 'Bucket', {
      bucketName: `${props.namePrefix}-website-${stageLower}-${stack.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: isProd,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
    });

    new CfnOutput(this, 'Name', {
      value: this.bucket.bucketName,
      description: 'Website static-site S3 bucket name',
      exportName: `${exportPrefix}-WebsiteBucketName`,
    });
  }
}
