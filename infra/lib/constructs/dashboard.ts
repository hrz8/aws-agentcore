import type * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

import type { Stage } from '../config.js';
import type { BedrockKnowledgeBase } from './bedrock-kb.js';
import { DashboardAssetsBucket } from './dashboard-assets-bucket.js';
import { DashboardAssetsDeployment } from './dashboard-assets-deployment.js';
import { DashboardDistribution } from './dashboard-distribution.js';
import { DashboardFunctionUrl } from './dashboard-function-url.js';
import { DashboardServer } from './dashboard-server.js';
import { EdgeSecret } from './edge-secret.js';

export type DashboardProps = {
  readonly namePrefix: string;
  readonly stage: Stage;
  readonly serverAssetPath: string;
  readonly publicAssetPath: string;
  readonly uploadsBucket: s3.IBucket;
  readonly kb: BedrockKnowledgeBase;
  readonly widgetDemoUrl: string;
  readonly middlewareUrl: string;
  /** Optional custom domain(s) for the dashboard, e.g. ['dashboard.company.com']. */
  readonly domainNames?: string[];
  /** ACM certificate ARN in us-east-1 covering `domainNames`. */
  readonly certificateArn?: string;
  /** Optional WAF WebACL ARN (scope=CLOUDFRONT) attached to the CloudFront distribution. */
  readonly webAclId?: string;
};

export class Dashboard extends Construct {
  readonly server: DashboardServer;
  readonly functionUrl: DashboardFunctionUrl;
  readonly assetsBucket: DashboardAssetsBucket;
  readonly distribution: DashboardDistribution;
  readonly edgeSecret: EdgeSecret;

  constructor(scope: Construct, id: string, props: DashboardProps) {
    super(scope, id);

    this.assetsBucket = new DashboardAssetsBucket(this, 'AssetsBucket', {
      namePrefix: props.namePrefix,
      stage: props.stage,
    });

    this.edgeSecret = new EdgeSecret(this, 'EdgeSecret', {
      namePrefix: props.namePrefix,
      stage: props.stage,
      componentName: 'dashboard',
    });

    this.server = new DashboardServer(this, 'Server', {
      namePrefix: props.namePrefix,
      stage: props.stage,
      serverAssetPath: props.serverAssetPath,
      uploadsBucket: props.uploadsBucket,
      kb: props.kb,
      widgetDemoUrl: props.widgetDemoUrl,
      middlewareUrl: props.middlewareUrl,
      edgeSecret: this.edgeSecret,
    });

    this.functionUrl = new DashboardFunctionUrl(this, 'FunctionUrl', {
      namePrefix: props.namePrefix,
      stage: props.stage,
      fn: this.server.fn,
    });

    this.distribution = new DashboardDistribution(this, 'Distribution', {
      stage: props.stage,
      functionUrl: this.functionUrl.functionUrl,
      assetsBucket: this.assetsBucket.bucket,
      edgeSecret: this.edgeSecret,
      domainNames: props.domainNames,
      certificateArn: props.certificateArn,
      webAclId: props.webAclId,
    });

    new DashboardAssetsDeployment(this, 'AssetsDeployment', {
      assetsBucket: this.assetsBucket.bucket,
      distribution: this.distribution.distribution,
      publicAssetPath: props.publicAssetPath,
    });
  }
}
