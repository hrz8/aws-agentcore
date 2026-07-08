import { CfnOutput } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

import type { Stage } from '../config.js';

export type DashboardFunctionUrlProps = {
  readonly namePrefix: string;
  readonly stage: Stage;
  readonly fn: lambda.IFunction;
};

export class DashboardFunctionUrl extends Construct {
  readonly functionUrl: lambda.FunctionUrl;

  constructor(scope: Construct, id: string, props: DashboardFunctionUrlProps) {
    super(scope, id);

    const { fn, stage, namePrefix } = props;

    // Same-origin behind CloudFront; no CORS block needed.
    this.functionUrl = fn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
    });

    new CfnOutput(this, 'Url', {
      value: this.functionUrl.url,
      description: 'Dashboard Function URL (raw)',
      exportName: `${stage}-${namePrefix}-DashboardFunctionUrl`,
    });
  }
}
