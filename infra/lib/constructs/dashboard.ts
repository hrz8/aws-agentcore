import type * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

import type { Stage } from '../config.js';
import type { BedrockKnowledgeBase } from './bedrock-kb.js';
import { DashboardApi } from './dashboard-api.js';
import { DashboardAssetsBucket } from './dashboard-assets-bucket.js';
import { DashboardAssetsDeployment } from './dashboard-assets-deployment.js';
import { DashboardDistribution } from './dashboard-distribution.js';
import { DashboardServer } from './dashboard-server.js';

export type DashboardProps = {
  readonly namePrefix: string;
  readonly stage: Stage;
  readonly serverAssetPath: string;
  readonly publicAssetPath: string;
  readonly uploadsBucket: s3.IBucket;
  readonly kb: BedrockKnowledgeBase;
  readonly widgetDemoUrl: string;
};

export class Dashboard extends Construct {
  readonly server: DashboardServer;
  readonly api: DashboardApi;
  readonly assetsBucket: DashboardAssetsBucket;
  readonly distribution: DashboardDistribution;

  constructor(scope: Construct, id: string, props: DashboardProps) {
    super(scope, id);

    this.assetsBucket = new DashboardAssetsBucket(this, 'AssetsBucket', {
      namePrefix: props.namePrefix,
      stage: props.stage,
    });

    this.server = new DashboardServer(this, 'Server', {
      namePrefix: props.namePrefix,
      stage: props.stage,
      serverAssetPath: props.serverAssetPath,
      uploadsBucket: props.uploadsBucket,
      kb: props.kb,
      widgetDemoUrl: props.widgetDemoUrl,
    });

    this.api = new DashboardApi(this, 'Api', {
      namePrefix: props.namePrefix,
      stage: props.stage,
      serverFn: this.server.fn,
    });

    this.distribution = new DashboardDistribution(this, 'Distribution', {
      stage: props.stage,
      api: this.api.api,
      assetsBucket: this.assetsBucket.bucket,
    });

    new DashboardAssetsDeployment(this, 'AssetsDeployment', {
      assetsBucket: this.assetsBucket.bucket,
      distribution: this.distribution.distribution,
      publicAssetPath: props.publicAssetPath,
    });
  }
}
