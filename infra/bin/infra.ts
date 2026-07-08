#!/usr/bin/env node

import { App } from 'aws-cdk-lib';

import { AWS_ACCOUNT_ID, AWS_REGION, Stages } from '../lib/config.js';
import { Nd8Stage } from '../lib/stage.js';

const app = new App();
const env = {
  account: AWS_ACCOUNT_ID,
  region: AWS_REGION,
};

new Nd8Stage(app, Stages.Dev, { env });
new Nd8Stage(app, Stages.Prod, { env });

app.synth();
