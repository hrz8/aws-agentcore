import type * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import type * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

import { type Stage } from '../config.js';
import { PublicAssetsBasicAuthFunction } from './public-assets-basic-auth-function.js';
import { PublicAssetsDistribution } from './public-assets-distribution.js';

export type PublicAssetsProps = {
  readonly namePrefix: string;
  readonly stage: Stage;
  readonly bucket: s3.IBucket;
  readonly widgetDemoAuthSecretName?: string;
  // ACM certificate MUST live in us-east-1.
  readonly customDomain?: {
    readonly domainName: string;
    readonly certificate: certificatemanager.ICertificate;
  };
};

export class PublicAssets extends Construct {
  readonly distribution: PublicAssetsDistribution;

  get url(): string {
    return this.distribution.url;
  }

  constructor(scope: Construct, id: string, props: PublicAssetsProps) {
    super(scope, id);

    const basicAuth = new PublicAssetsBasicAuthFunction(this, 'BasicAuthFn', {
      namePrefix: props.namePrefix,
      stage: props.stage,
      secretName: props.widgetDemoAuthSecretName,
    });

    this.distribution = new PublicAssetsDistribution(this, 'Distribution', {
      stage: props.stage,
      namePrefix: props.namePrefix,
      assetsBucket: props.bucket,
      basicAuthFunction: basicAuth.function,
      customDomain: props.customDomain,
    });
  }
}
