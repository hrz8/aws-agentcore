#!/usr/bin/env node

import { App } from 'aws-cdk-lib';

import { AWS_ACCOUNT_ID, AWS_REGION, Stages } from '../lib/config.js';
import { DemoAgentcoreStage } from '../lib/stage.js';

const app = new App();
const env = {
  account: AWS_ACCOUNT_ID,
  region: AWS_REGION,
};

new DemoAgentcoreStage(app, Stages.Dev, { env });
new DemoAgentcoreStage(app, Stages.Prod, { env });

app.synth();
