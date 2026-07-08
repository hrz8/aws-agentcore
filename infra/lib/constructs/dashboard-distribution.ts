import { CfnOutput, Fn, Stack } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import type * as lambda from 'aws-cdk-lib/aws-lambda';
import type * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

import type { Stage } from '../config.js';
import type { EdgeSecret } from './edge-secret.js';

export type DashboardDistributionProps = {
  readonly stage: Stage;
  readonly functionUrl: lambda.IFunctionUrl;
  readonly assetsBucket: s3.IBucket;
  readonly edgeSecret: EdgeSecret;
  /** Optional custom domain(s) for the dashboard, e.g. ['dashboard.company.com']. */
  readonly domainNames?: string[];
  /** ACM certificate ARN. MUST live in us-east-1 (CloudFront requirement). */
  readonly certificateArn?: string;
  /** Optional WAF WebACL ARN (scope=CLOUDFRONT). */
  readonly webAclId?: string;
};

export class DashboardDistribution extends Construct {
  readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: DashboardDistributionProps) {
    super(scope, id);

    const { functionUrl, assetsBucket, edgeSecret, domainNames, certificateArn, webAclId } = props;
    const stack = Stack.of(this);

    if ((domainNames?.length ?? 0) > 0 && !certificateArn) {
      throw new Error('DashboardDistribution: domainNames set but certificateArn missing (ACM cert must be in us-east-1)');
    }

    const originDomain = Fn.select(2, Fn.split('/', functionUrl.url));

    const staticBehavior: cloudfront.BehaviorOptions = {
      origin: origins.S3BucketOrigin.withOriginAccessControl(assetsBucket),
      cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    };

    // compress:false + CACHING_DISABLED are required for SSR response streaming.
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `nd8 dashboard — SSR + static assets (${props.stage})`,
      defaultBehavior: {
        origin: new origins.HttpOrigin(originDomain, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          customHeaders: { 'x-origin-secret': edgeSecret.originSecretValue },
        }),
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
      domainNames: domainNames && domainNames.length > 0 ? domainNames : undefined,
      certificate: certificateArn
        ? acm.Certificate.fromCertificateArn(this, 'Cert', certificateArn)
        : undefined,
      webAclId,
    });

    new CfnOutput(stack, `${id}Url`, {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'Dashboard CloudFront URL',
    });
  }
}
