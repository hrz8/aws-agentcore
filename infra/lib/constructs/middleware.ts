import type * as ddb from 'aws-cdk-lib/aws-dynamodb';
import type * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

import type { Stage } from '../config.js';
import type { Agentcore } from './agentcore.js';
import { MiddlewareDistribution } from './middleware-distribution.js';
import { MiddlewareFunctionUrl } from './middleware-function-url.js';
import { MiddlewareServer } from './middleware-server.js';

export type MiddlewareProps = {
  readonly namePrefix: string;
  readonly stage: Stage;
  readonly serverAssetPath: string;
  readonly uploadsBucket: s3.IBucket;
  readonly threadTable: ddb.ITable;
  readonly agentcore: Agentcore;
  readonly allowedOrigins: string[];
  readonly threadTtlDays: number;
  /** Optional company domain(s) for the middleware, e.g. ['agent.company.com']. */
  readonly domainNames?: string[];
  /** ACM certificate ARN in us-east-1 covering `domainNames`. */
  readonly certificateArn?: string;
  /** Optional WAF WebACL ARN attached to the CloudFront distribution. */
  readonly webAclId?: string;
};

export class Middleware extends Construct {
  readonly server: MiddlewareServer;
  readonly functionUrl: MiddlewareFunctionUrl;
  readonly distribution: MiddlewareDistribution;
  readonly url: string;

  constructor(scope: Construct, id: string, props: MiddlewareProps) {
    super(scope, id);

    this.server = new MiddlewareServer(this, 'Server', {
      namePrefix: props.namePrefix,
      stage: props.stage,
      serverAssetPath: props.serverAssetPath,
      uploadsBucket: props.uploadsBucket,
      threadTable: props.threadTable,
      agentcore: props.agentcore,
      threadTtlDays: props.threadTtlDays,
    });

    this.functionUrl = new MiddlewareFunctionUrl(this, 'FunctionUrl', {
      namePrefix: props.namePrefix,
      stage: props.stage,
      fn: this.server.fn,
      allowedOrigins: props.allowedOrigins,
    });

    this.distribution = new MiddlewareDistribution(this, 'Distribution', {
      namePrefix: props.namePrefix,
      stage: props.stage,
      functionUrl: this.functionUrl.functionUrl,
      domainNames: props.domainNames,
      certificateArn: props.certificateArn,
      webAclId: props.webAclId,
    });

    this.url = this.distribution.url;
  }
}
