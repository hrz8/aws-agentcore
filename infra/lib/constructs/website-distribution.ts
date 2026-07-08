import { CfnOutput, Duration } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import type * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

import { type Stage } from '../config.js';

export type WebsiteDistributionProps = {
  readonly stage: Stage;
  readonly namePrefix: string;
  readonly assetsBucket: s3.IBucket;
  readonly localeRedirectFunction: cloudfront.IFunction;
  // ACM certificate MUST live in us-east-1.
  readonly customDomain?: {
    readonly domainName: string;
    readonly certificate: import('aws-cdk-lib/aws-certificatemanager').ICertificate;
  };
};

export class WebsiteDistribution extends Construct {
  readonly distribution: cloudfront.Distribution;

  get url(): string {
    return `https://${this.distribution.distributionDomainName}`;
  }

  constructor(scope: Construct, id: string, props: WebsiteDistributionProps) {
    super(scope, id);

    const { assetsBucket, localeRedirectFunction, customDomain } = props;
    const exportPrefix = `${props.stage}-${props.namePrefix}`;

    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(assetsBucket);

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `nd8 website (${props.stage})`,
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: s3Origin,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        compress: true,
        functionAssociations: [{
          function: localeRedirectFunction,
          eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
        }],
      },
      // S3 returns 403 for missing objects on private buckets — surface as 404.
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 404,
          responsePagePath: '/404.html',
          ttl: Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 404,
          responsePagePath: '/404.html',
          ttl: Duration.minutes(5),
        },
      ],
      httpVersion: cloudfront.HttpVersion.HTTP3,
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      ...(customDomain && {
        domainNames: [customDomain.domainName],
        certificate: customDomain.certificate,
      }),
    });

    new CfnOutput(this, 'Id', {
      value: this.distribution.distributionId,
      description: 'Website CloudFront distribution ID (for invalidations)',
      exportName: `${exportPrefix}-WebsiteDistributionId`,
    });

    new CfnOutput(this, 'Url', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'Website CloudFront URL',
      exportName: `${exportPrefix}-WebsiteDistributionUrl`,
    });

    if (customDomain) {
      new CfnOutput(this, 'CustomDomain', {
        value: `https://${customDomain.domainName}`,
        description: 'Website custom domain',
      });
    }
  }
}
