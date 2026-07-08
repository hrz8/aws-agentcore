import { CfnOutput } from 'aws-cdk-lib';
import * as wafv2 from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';

import type { Stage } from '../config.js';

export type EdgeWafProps = {
  readonly namePrefix: string;
  readonly stage: Stage;
  /** Component this WAF fronts — becomes part of resource/metric/export names (e.g. 'middleware'). */
  readonly componentName: string;
  /** Rate limit per IP over a 5-min window. */
  readonly ipRateLimit?: number;
  /** Rate limit per x-tenant-id header over a 5-min window. Omit to skip the tenant rule. */
  readonly tenantRateLimit?: number;
};

function titleCase(s: string): string {
  return s.length === 0 ? s : s[0]!.toUpperCase() + s.slice(1);
}

// SCOPE=CLOUDFRONT WebACLs must be created in us-east-1.
export class EdgeWaf extends Construct {
  readonly webAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: EdgeWafProps) {
    super(scope, id);

    const { namePrefix, stage, componentName, ipRateLimit = 500, tenantRateLimit } = props;
    const stageLower = stage.toLowerCase();
    const resourceName = `${namePrefix}-${componentName}-${stageLower}`;
    const metricPrefix = resourceName;

    const rules: wafv2.CfnWebACL.RuleProperty[] = [
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
    ];

    if (tenantRateLimit !== undefined) {
      rules.push({
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
      });
    }

    this.webAcl = new wafv2.CfnWebACL(this, 'WebAcl', {
      name: resourceName,
      scope: 'CLOUDFRONT',
      defaultAction: { allow: {} },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `${metricPrefix}-webacl`,
        sampledRequestsEnabled: true,
      },
      rules,
    });

    new CfnOutput(this, 'Arn', {
      value: this.webAcl.attrArn,
      description: `${titleCase(componentName)} WAF WebACL ARN`,
      exportName: `${stage}-${namePrefix}-${titleCase(componentName)}WafArn`,
    });
  }
}
