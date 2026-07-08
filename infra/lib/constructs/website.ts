import type * as certificatemanager from 'aws-cdk-lib/aws-certificatemanager';
import type * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

import { type Stage } from '../config.js';
import { WebsiteDistribution } from './website-distribution.js';
import { WebsiteLocaleRedirectFunction } from './website-locale-redirect-function.js';

export type WebsiteProps = {
  readonly namePrefix: string;
  readonly stage: Stage;
  readonly bucket: s3.IBucket;
  readonly localeCookieName?: string;
  readonly secondaryLocaleTag?: string;
  readonly secondaryLocalePrefix?: string;
  // ACM certificate MUST live in us-east-1.
  readonly customDomain?: {
    readonly domainName: string;
    readonly certificate: certificatemanager.ICertificate;
  };
};

export class Website extends Construct {
  readonly distribution: WebsiteDistribution;

  get url(): string {
    return this.distribution.url;
  }

  constructor(scope: Construct, id: string, props: WebsiteProps) {
    super(scope, id);

    const localeFn = new WebsiteLocaleRedirectFunction(this, 'LocaleFn', {
      namePrefix: props.namePrefix,
      stage: props.stage,
      localeCookieName: props.localeCookieName,
      secondaryLocaleTag: props.secondaryLocaleTag,
      secondaryLocalePrefix: props.secondaryLocalePrefix,
    });

    this.distribution = new WebsiteDistribution(this, 'Distribution', {
      stage: props.stage,
      namePrefix: props.namePrefix,
      assetsBucket: props.bucket,
      localeRedirectFunction: localeFn.function,
      customDomain: props.customDomain,
    });
  }
}
