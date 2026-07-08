import type { StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';

import type { Stage } from './config.js';

import * as path from 'node:path';
import { Stack } from 'aws-cdk-lib';

import { Agentcore } from './constructs/agentcore.js';
import { BedrockKnowledgeBase } from './constructs/bedrock-kb.js';
import { Dashboard } from './constructs/dashboard.js';
import { PublicAssets } from './constructs/public-assets.js';
import { PublicAssetsBucket } from './constructs/public-assets-bucket.js';
import { UploadsBucket } from './constructs/uploads-bucket.js';

const STACK_NAME = 'Nd8Stack';
const NAME_PREFIX = 'nd8';

const KB_PREFIX = 'kb/';
const SKILLS_PREFIX = 'skills/';
const REGISTRY_PREFIX = 'registry/';

export type Nd8StackProps = StackProps & {
  readonly stage: Stage;
};

export class Nd8Stack extends Stack {
  readonly uploadsBucket: UploadsBucket;
  readonly publicAssetsBucket: PublicAssetsBucket;
  readonly kb: BedrockKnowledgeBase;
  readonly agentcore: Agentcore;
  readonly publicAssets: PublicAssets;

  constructor(scope: Construct, props: Nd8StackProps) {
    super(scope, STACK_NAME, props);

    const { stage } = props;

    const repoRoot = path.resolve(__dirname, '..', '..');

    this.uploadsBucket = new UploadsBucket(this, 'UploadsBucket', {
      namePrefix: NAME_PREFIX,
      stage,
      corsOrigins: ['https://*.cloudfront.net'],
    });

    this.publicAssetsBucket = new PublicAssetsBucket(this, 'PublicAssetsBucket', {
      namePrefix: NAME_PREFIX,
      stage,
    });

    this.kb = new BedrockKnowledgeBase(this, 'Kb', {
      namePrefix: NAME_PREFIX,
      stage,
      docsBucket: this.uploadsBucket.bucket,
      s3InclusionPrefix: KB_PREFIX,
      customWebDataSource: true,
    });

    this.agentcore = new Agentcore(this, 'Agentcore', {
      stage,
      namePrefix: NAME_PREFIX,
      dockerAssetPath: repoRoot,
      dockerfile: 'apps/agent/Dockerfile',
      uploadsBucket: this.uploadsBucket.bucket,
      uploadsBucketReadPrefixes: [SKILLS_PREFIX, REGISTRY_PREFIX],
      kb: this.kb,
    });

    this.publicAssets = new PublicAssets(this, 'PublicAssets', {
      namePrefix: NAME_PREFIX,
      stage,
      bucket: this.publicAssetsBucket.bucket,
    });

    new Dashboard(this, 'Dashboard', {
      namePrefix: NAME_PREFIX,
      stage,
      serverAssetPath: path.join(repoRoot, 'apps', 'dashboard', '.output', 'server'),
      publicAssetPath: path.join(repoRoot, 'apps', 'dashboard', '.output', 'public'),
      uploadsBucket: this.uploadsBucket.bucket,
      kb: this.kb,
      widgetDemoUrl: `${this.publicAssets.url}/widget-demo.html`,
    });
  }
}
