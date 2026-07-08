import { CfnOutput } from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

import type { Stage } from '../config.js';

export type MiddlewareWafProps = {
  readonly namePrefix: string;
  readonly stage: Stage;
  /** Rate limit per IP over a 5-min window. */
  readonly ipRateLimit?: number;
  /** Rate limit per x-tenant-id over a 5-min window. */
  readonly tenantRateLimit?: number;
};

// SCOPE=CLOUDFRONT WebACLs must be created in us-east-1.
export class MiddlewareWaf extends Construct {
  readonly webAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: MiddlewareWafProps) {
    super(scope, id);

    const { namePrefix, stage, ipRateLimit = 500, tenantRateLimit = 2000 } = props;
    const stageLower = stage.toLowerCase();
    const metricPrefix = `${namePrefix}-middleware-${stageLower}`;

    this.webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
      name: `${namePrefix}-middleware-${stageLower}`,
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `${metricPrefix}-webacl`,
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: 'AWSManagedCommonRules',
          priority: 10,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesCommonRuleSet',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `${metricPrefix}-common`,
            sampledRequestsEnabled: true,
          },
        },
        {
          name: 'AWSManagedKnownBadInputs',
          priority: 20,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS',
              name: 'AWSManagedRulesKnownBadInputsRuleSet',
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `${metricPrefix}-badinputs`,
            sampledRequestsEnabled: true,
          },
        },
        {
          name: 'RateLimitPerIp',
          priority: 30,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: ipRateLimit,
              aggregateKeyType: 'IP',
              evaluationWindowSec: 300,
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `${metricPrefix}-ratelimit-ip`,
            sampledRequestsEnabled: true,
          },
        },
        {
          name: 'RateLimitPerTenant',
          priority: 40,
          action: { block: {} },
          statement: {
            rateBasedStatement: {
              limit: tenantRateLimit,
              aggregateKeyType: 'CUSTOM_KEYS',
              evaluationWindowSec: 300,
              customKeys: [
                {
                  header: {
                    name: 'x-tenant-id',
                    textTransformations: [{ priority: 0, type: 'LOWERCASE' }],
                  },
                },
              ],
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: `${metricPrefix}-ratelimit-tenant`,
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    new CfnOutput(this, 'Arn', {
      value: this.webAcl.attrArn,
      description: 'Middleware WAF WebACL ARN',
      exportName: `${stage}-${namePrefix}-MiddlewareWafArn`,
    });
  }
}
