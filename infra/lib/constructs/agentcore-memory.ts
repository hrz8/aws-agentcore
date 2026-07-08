import type * as kms from 'aws-cdk-lib/aws-kms';
import type { Stage } from '../config.js';

import * as agentcore from 'aws-cdk-lib/aws-bedrockagentcore';
import { CfnOutput, Duration } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export type AgentCoreMemoryProps = {
  readonly stage: Stage;
  readonly namePrefix: string;
  readonly agentName: string;
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

    const { stage, namePrefix, agentName, expirationDays, kmsKey } = props;
    this.kmsKey = kmsKey;

    this.namespaceFacts = '/actor/{actorId}/facts';
    this.namespacePreferences = '/actor/{actorId}/preferences';
    this.namespaceSummary = '/actor/{actorId}/session/{sessionId}/summary';

    this.memory = new agentcore.Memory(this, 'Memory', {
      memoryName: `${agentName}_${stage.toLowerCase()}`,
      description: `${agentName} memory (${stage})`,
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

    const exportPrefix = `${stage}-${namePrefix}`;

    new CfnOutput(this, 'MemoryId', {
      value: this.memory.memoryId,
      description: `${agentName} AgentCore Memory ID`,
      exportName: `${exportPrefix}-AgentMemoryId`,
    });

    new CfnOutput(this, 'MemoryArn', {
      value: this.memory.memoryArn,
      description: `${agentName} AgentCore Memory ARN`,
      exportName: `${exportPrefix}-AgentMemoryArn`,
    });
  }
}
