import type * as kms from 'aws-cdk-lib/aws-kms';
import type { Stage } from '../config.js';

import * as agentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import { CfnOutput, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';

const MEMORY_NAME = 'DemoAgent';

export type AgentCoreMemoryProps = {
  readonly stage: Stage;
  /** STM event retention in days (7–365). */
  readonly expirationDays?: number;
  /** Customer-managed KMS key; AWS-managed key used if omitted. */
  readonly kmsKey?: kms.IKey;
};

export class AgentCoreMemory extends Construct {
  readonly memory: agentcore.Memory;
  readonly kmsKey?: kms.IKey;
  readonly namespaceFacts: string;
  readonly namespacePreferences: string;
  readonly namespaceSummary: string;

  constructor(scope: Construct, id: string, props: AgentCoreMemoryProps) {
    super(scope, id);

    const { stage, expirationDays, kmsKey } = props;
    this.kmsKey = kmsKey;

    this.namespaceFacts = '/actor/{actorId}/facts';
    this.namespacePreferences = '/actor/{actorId}/preferences';
    this.namespaceSummary = '/actor/{actorId}/session/{sessionId}/summary';

    this.memory = new agentcore.Memory(this, 'Memory', {
      memoryName: `${MEMORY_NAME}_${stage.toLowerCase()}`,
      description: `${MEMORY_NAME} memory (${stage})`,
      expirationDuration: Duration.days(expirationDays ?? 90),
      kmsKey,
      memoryStrategies: [
        agentcore.MemoryStrategy.usingSemantic({
          strategyName: 'semantic',
          namespaces: [this.namespaceFacts],
        }),
        agentcore.MemoryStrategy.usingUserPreference({
          strategyName: 'user_preference',
          namespaces: [this.namespacePreferences],
        }),
        agentcore.MemoryStrategy.usingSummarization({
          strategyName: 'summary',
          namespaces: [this.namespaceSummary],
        }),
      ],
    });

    const exportPrefix = `${stage}-${MEMORY_NAME}`;

    new CfnOutput(this, 'MemoryId', {
      value: this.memory.memoryId,
      description: `${MEMORY_NAME} AgentCore Memory ID`,
      exportName: `${exportPrefix}-MemoryId`,
    });

    new CfnOutput(this, 'MemoryArn', {
      value: this.memory.memoryArn,
      description: `${MEMORY_NAME} AgentCore Memory ARN`,
      exportName: `${exportPrefix}-MemoryArn`,
    });
  }
}
