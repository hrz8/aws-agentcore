import { CfnOutput, Fn } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import type * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

import type { Stage } from '../config.js';
import type { EdgeSecret } from './edge-secret.js';

export type MiddlewareDistributionProps = {
  readonly namePrefix: string;
  readonly stage: Stage;
  readonly functionUrl: lambda.IFunctionUrl;
  readonly edgeSecret: EdgeSecret;
  readonly domainNames?: string[];
  /** ACM certificate ARN. MUST live in us-east-1 (CloudFront requirement). */
  readonly certificateArn?: string;
  readonly webAclId?: string;
};

export class MiddlewareDistribution extends Construct {
  readonly distribution: cloudfront.Distribution;
  readonly url: string;

  constructor(scope: Construct, id: string, props: MiddlewareDistributionProps) {
    super(scope, id);

    const { functionUrl, stage, namePrefix, edgeSecret, domainNames, certificateArn, webAclId } = props;

    if ((domainNames?.length ?? 0) > 0 && !certificateArn) {
      throw new Error('MiddlewareDistribution: domainNames set but certificateArn missing (ACM cert must be in us-east-1)');
    }

    const originDomain = Fn.select(2, Fn.split('/', functionUrl.url));

    // compress:false + CACHING_DISABLED are required for streaming SSE.
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `nd8 middleware — AG-UI streaming edge (${stage})`,
      defaultBehavior: {
        origin: new origins.HttpOrigin(originDomain, {
          protocolPolicy: cloudfront.OriginProtocolPolicy.HTTPS_ONLY,
          customHeaders: { 'x-origin-secret': edgeSecret.originSecretValue },
        }),
        allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
        cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
        compress: false,
        originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      httpVersion: cloudfront.HttpVersion.HTTP3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      domainNames: domainNames && domainNames.length > 0 ? domainNames : undefined,
      certificate: certificateArn
        ? acm.Certificate.fromCertificateArn(this, 'Cert', certificateArn)
        : undefined,
      webAclId,
    });

    this.url = `https://${this.distribution.distributionDomainName}`;

    new CfnOutput(this, 'Url', {
      value: this.url,
      description: 'Middleware CloudFront URL',
      exportName: `${stage}-${namePrefix}-MiddlewareUrl`,
    });
  }
}
