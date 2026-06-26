import type { StageProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';

import type { Stage } from './config.js';

import { Stage as CdkStage } from 'aws-cdk-lib';

import { DemoAgentcoreStack } from './stack.js';

export class DemoAgentcoreStage extends CdkStage {
  constructor(scope: Construct, stage: Stage, props: StageProps) {
    super(scope, stage, props);

    new DemoAgentcoreStack(this, { stage });
  }
}
