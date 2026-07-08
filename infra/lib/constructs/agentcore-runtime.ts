import type { Stage } from '../config.js';
import type { AgentCoreMemory } from './agentcore-memory.js';
import type { BedrockKnowledgeBase } from './bedrock-kb.js';

import * as agentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import { CfnOutput } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import type * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

export type AgentcoreRuntimeProps = {
  readonly namePrefix: string;
  readonly agentName: string;
  readonly stage: Stage;
  readonly dockerAssetPath: string;
  readonly dockerfile?: string;
  readonly protocol?: agentcore.ProtocolType;
  readonly description?: string;
  readonly environmentVariables?: Record<string, string>;
  readonly kbRetrieveAccess?: BedrockKnowledgeBase;
  readonly uploadsBucketReadAccess?: {
    readonly bucket: s3.IBucket;
    readonly prefixes: readonly string[];
  };
  readonly memoryAccess?: AgentCoreMemory;
};

export class AgentcoreRuntime extends Construct {
  readonly runtime: agentcore.Runtime;
  readonly runtimeArn: string;

  constructor(scope: Construct, id: string, props: AgentcoreRuntimeProps) {
    super(scope, id);

    const {
      namePrefix,
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

    if (props.kbRetrieveAccess) {
      this.runtime.addToRolePolicy(new iam.PolicyStatement({
        sid: 'BedrockRetrieveOnSharedKb',
        actions: ['bedrock:Retrieve'],
        resources: [props.kbRetrieveAccess.kbArn],
      }));
    }

    if (props.uploadsBucketReadAccess) {
      const { bucket, prefixes } = props.uploadsBucketReadAccess;
      this.runtime.addToRolePolicy(new iam.PolicyStatement({
        sid: 'S3ReadUploadsPrefixes',
        actions: ['s3:GetObject'],
        resources: prefixes.map((p) => `${bucket.bucketArn}/${p}*`),
      }));
      this.runtime.addToRolePolicy(new iam.PolicyStatement({
        sid: 'S3ListUploadsPrefixes',
        actions: ['s3:ListBucket'],
        resources: [bucket.bucketArn],
        conditions: {
          StringLike: { 's3:prefix': prefixes.map((p) => `${p}*`) },
        },
      }));
    }

    if (props.memoryAccess) {
      props.memoryAccess.memory.grantWrite(this.runtime);
      props.memoryAccess.memory.grantReadLongTermMemory(this.runtime);
    }

    this.runtime.addEndpoint(`${agentName}Endpoint`, {
      description: `${agentName} ${stage} endpoint`,
    });

    this.runtimeArn = this.runtime.agentRuntimeArn;

    const exportPrefix = `${stage}-${namePrefix}`;

    new CfnOutput(this, 'RuntimeArn', {
      value: this.runtime.agentRuntimeArn,
      description: `${agentName} AgentCore Runtime ARN`,
      exportName: `${exportPrefix}-AgentRuntimeArn`,
    });

    new CfnOutput(this, 'RuntimeId', {
      value: this.runtime.agentRuntimeId,
      description: `${agentName} AgentCore Runtime ID`,
      exportName: `${exportPrefix}-AgentRuntimeId`,
    });
  }
}
