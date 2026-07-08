import { CfnOutput, RemovalPolicy, Stack } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

import { Stages, type Stage } from '../config.js';

export type DashboardAssetsBucketProps = {
  readonly namePrefix: string;
  readonly stage: Stage;
};

export class DashboardAssetsBucket extends Construct {
  readonly bucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: DashboardAssetsBucketProps) {
    super(scope, id);

    const stack = Stack.of(this);
    const isProd = props.stage === Stages.Prod;
    const stageLower = props.stage.toLowerCase();

    this.bucket = new s3.Bucket(this, 'Bucket', {
      bucketName: `${props.namePrefix}-dashboard-${stageLower}-${stack.account}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      versioned: isProd,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: !isProd,
    });

    new CfnOutput(stack, `${id}Name`, {
      value: this.bucket.bucketName,
      description: `Dashboard static assets S3 bucket name (${id})`,
    });
  }
}
