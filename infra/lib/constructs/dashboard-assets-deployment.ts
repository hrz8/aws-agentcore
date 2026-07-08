import type * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import type * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export type DashboardAssetsDeploymentProps = {
  readonly assetsBucket: s3.IBucket;
  readonly distribution: cloudfront.IDistribution;
  readonly publicAssetPath: string;
};

export class DashboardAssetsDeployment extends Construct {
  constructor(scope: Construct, id: string, props: DashboardAssetsDeploymentProps) {
    super(scope, id);

    const { assetsBucket, distribution, publicAssetPath } = props;

    new s3deploy.BucketDeployment(this, 'Deployment', {
      destinationBucket: assetsBucket,
      sources: [s3deploy.Source.asset(publicAssetPath)],
      distribution,
      distributionPaths: ['/*'],
      prune: true,
      memoryLimit: 2048,
    });
  }
}
