import { CfnOutput, Stack } from 'aws-cdk-lib';
import type * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import type * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

import type { Stage } from '../config.js';

export type DashboardDistributionProps = {
  readonly stage: Stage;
  readonly api: apigw.RestApi;
  readonly assetsBucket: s3.IBucket;
};

export class DashboardDistribution extends Construct {
  readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: DashboardDistributionProps) {
    super(scope, id);

    const { api, assetsBucket } = props;
    const stack = Stack.of(this);

    const staticBehavior: cloudfront.BehaviorOptions = {
      origin: origins.S3BucketOrigin.withOriginAccessControl(assetsBucket),
      cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    };

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `nd8 dashboard — SSR + static assets (${props.stage})`,
      defaultBehavior: {
        origin: new origins.RestApiOrigin(api),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        compress: false,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      additionalBehaviors: {
        '/assets/*': staticBehavior,
        '/favicon.ico': staticBehavior,
        '/favicon-*.png': staticBehavior,
      },
      httpVersion: cloudfront.HttpVersion.HTTP3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    new CfnOutput(stack, `${id}Url`, {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'Dashboard CloudFront URL',
    });
  }
}
