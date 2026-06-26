import type { Stage } from '../config.js';

import * as agentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import { CfnOutput, Stack } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export type AgentcoreRuntimeProps = {
  readonly agentName: string;
  readonly stage: Stage;
  readonly dockerAssetPath: string;
  readonly dockerfile?: string;
  readonly protocol?: agentcore.ProtocolType;
  readonly description?: string;
  readonly environmentVariables?: Record<string, string>;
};

export class AgentcoreRuntime extends Construct {
  readonly runtime: agentcore.Runtime;
  readonly runtimeArn: string;

  constructor(scope: Construct, id: string, props: AgentcoreRuntimeProps) {
    super(scope, id);

    const {
      agentName,
      stage,
      dockerAssetPath,
      dockerfile,
      protocol = agentcore.ProtocolType.HTTP,
      description,
      environmentVariables,
    } = props;

    this.runtime = new agentcore.Runtime(this, 'Runtime', {
      runtimeName: `${agentName}_${stage}`,
      description: description ?? `${agentName} (${stage})`,
      agentRuntimeArtifact: agentcore.AgentRuntimeArtifact.fromAsset(dockerAssetPath, {
        file: dockerfile,
      }),
      protocolConfiguration: protocol,
      networkConfiguration: agentcore.RuntimeNetworkConfiguration.usingPublicNetwork(),
      environmentVariables: environmentVariables ?? {},
    });

    this.runtime.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'bedrock:InvokeModel',
          'bedrock:InvokeModelWithResponseStream',
        ],
        resources: ['*'],
      }),
    );

    this.runtime.addEndpoint(`${agentName}Endpoint`, {
      description: `${agentName} ${stage} endpoint`,
    });

    this.runtimeArn = this.runtime.agentRuntimeArn;

    const stack = Stack.of(this);
    const exportPrefix = `${stage}-${agentName.replace(/_/g, '-')}`;

    new CfnOutput(stack, `${agentName}RuntimeArn`, {
      value: this.runtime.agentRuntimeArn,
      description: `${agentName} AgentCore Runtime ARN`,
      exportName: `${exportPrefix}-RuntimeArn`,
    });

    new CfnOutput(stack, `${agentName}RuntimeId`, {
      value: this.runtime.agentRuntimeId,
      description: `${agentName} AgentCore Runtime ID`,
      exportName: `${exportPrefix}-RuntimeId`,
    });
  }
}
