import { CfnOutput, Duration } from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import type * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

import { type Stage } from '../config.js';

export type PublicAssetsDistributionProps = {
  readonly stage: Stage;
  readonly namePrefix: string;
  readonly assetsBucket: s3.IBucket;
  readonly basicAuthFunction: cloudfront.IFunction;
  // ACM certificate MUST live in us-east-1.
  readonly customDomain?: {
    readonly domainName: string;
    readonly certificate: import('aws-cdk-lib/aws-certificatemanager').ICertificate;
  };
};

export class PublicAssetsDistribution extends Construct {
  readonly distribution: cloudfront.Distribution;

  get url(): string {
    return `https://${this.distribution.distributionDomainName}`;
  }

  constructor(scope: Construct, id: string, props: PublicAssetsDistributionProps) {
    super(scope, id);

    const { assetsBucket, basicAuthFunction, customDomain } = props;
    const exportPrefix = `${props.stage}-${props.namePrefix}`;

    const s3Origin = origins.S3BucketOrigin.withOriginAccessControl(assetsBucket);

    const cachedAssetBehavior: cloudfront.BehaviorOptions = {
      origin: s3Origin,
      cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
      responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.CORS_ALLOW_ALL_ORIGINS_WITH_PREFLIGHT,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
      compress: true,
    };

    const authGatedBehavior: cloudfront.BehaviorOptions = {
      origin: s3Origin,
      cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
      responseHeadersPolicy: cloudfront.ResponseHeadersPolicy.SECURITY_HEADERS,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      functionAssociations: [{
        function: basicAuthFunction,
        eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
      }],
    };

    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      comment: `nd8 public assets — widget, playground, uploads (${props.stage})`,
      defaultBehavior: cachedAssetBehavior,
      additionalBehaviors: {
        '/widget-demo.html': authGatedBehavior,
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 403,
          responsePagePath: '/index.html',
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
      description: 'Public assets CloudFront distribution ID (for invalidations)',
      exportName: `${exportPrefix}-PublicAssetsDistributionId`,
    });

    new CfnOutput(this, 'Url', {
      value: `https://${this.distribution.distributionDomainName}`,
      description: 'Public assets CloudFront URL',
      exportName: `${exportPrefix}-PublicAssetsDistributionUrl`,
    });

    if (customDomain) {
      new CfnOutput(this, 'CustomDomain', {
        value: `https://${customDomain.domainName}`,
        description: 'Public assets custom domain',
      });
    }
  }
}
