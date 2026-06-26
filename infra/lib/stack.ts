import type { StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';

import type { Stage } from './config.js';

import * as path from 'node:path';
import { Stack } from 'aws-cdk-lib';

import { AgentcoreRuntime } from './constructs/agentcore-runtime.js';

const STACK_NAME = 'DemoAgentcoreStack';

export type DemoAgentcoreStackProps = StackProps & {
  readonly stage: Stage;
};

export class DemoAgentcoreStack extends Stack {
  readonly runtime: AgentcoreRuntime;

  constructor(scope: Construct, props: DemoAgentcoreStackProps) {
    super(scope, STACK_NAME, props);

    const { stage } = props;

    const agentDir = path.resolve(__dirname, '..', '..', 'agent');

    this.runtime = new AgentcoreRuntime(this, 'DemoAgentRuntime', {
      agentName: 'DemoAgent',
      stage,
      dockerAssetPath: agentDir,
      dockerfile: 'Dockerfile',
      environmentVariables: {
        MODEL_PROVIDER: 'bedrock',
        BEDROCK_MODEL_ID: 'us.amazon.nova-lite-v1:0',
      },
    });
  }
}
