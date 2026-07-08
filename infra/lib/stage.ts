import type { StageProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';

import type { Stage } from './config.js';

import { Stage as CdkStage } from 'aws-cdk-lib';

import { Nd8Stack } from './stack.js';

export class Nd8Stage extends CdkStage {
  constructor(scope: Construct, stage: Stage, props: StageProps) {
    super(scope, stage, props);

    new Nd8Stack(this, { stage });
  }
}
