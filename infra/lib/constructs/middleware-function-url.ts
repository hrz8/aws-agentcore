import { CfnOutput } from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

import type { Stage } from '../config.js';

export type MiddlewareFunctionUrlProps = {
  readonly namePrefix: string;
  readonly stage: Stage;
  readonly fn: lambda.IFunction;
  readonly allowedOrigins: string[];
};

export class MiddlewareFunctionUrl extends Construct {
  readonly functionUrl: lambda.FunctionUrl;

  constructor(scope: Construct, id: string, props: MiddlewareFunctionUrlProps) {
    super(scope, id);

    const { fn, allowedOrigins, stage, namePrefix } = props;

    this.functionUrl = fn.addFunctionUrl({
      authType: lambda.FunctionUrlAuthType.NONE,
      invokeMode: lambda.InvokeMode.RESPONSE_STREAM,
      cors: {
        allowedOrigins,
        allowedMethods: [lambda.HttpMethod.GET, lambda.HttpMethod.POST],
        allowedHeaders: [
          'Content-Type',
          'Authorization',
          'x-tenant-id',
          'x-agent-id',
          'x-agent-version',
          'x-actor-id',
        ],
      },
    });

    new CfnOutput(this, 'Url', {
      value: this.functionUrl.url,
      description: 'Middleware Function URL (raw)',
      exportName: `${stage}-${namePrefix}-MiddlewareFunctionUrl`,
    });
  }
}
