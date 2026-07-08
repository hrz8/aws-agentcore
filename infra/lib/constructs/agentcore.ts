import type * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

import type { Stage } from '../config.js';
import { AgentCoreMemory } from './agentcore-memory.js';
import { AgentcoreRuntime } from './agentcore-runtime.js';
import type { BedrockKnowledgeBase } from './bedrock-kb.js';

export type AgentcoreProps = {
  readonly namePrefix: string;
  readonly stage: Stage;
  readonly dockerAssetPath: string;
  readonly dockerfile?: string;
  readonly uploadsBucket: s3.IBucket;
  readonly uploadsBucketReadPrefixes: readonly string[];
  readonly kb: BedrockKnowledgeBase;
};

export class Agentcore extends Construct {
  readonly memory: AgentCoreMemory;
  readonly runtime: AgentcoreRuntime;
  readonly agentName: string;

  constructor(scope: Construct, id: string, props: AgentcoreProps) {
    super(scope, id);

    this.agentName = `${props.namePrefix}Agent`;

    this.memory = new AgentCoreMemory(this, 'Memory', {
      stage: props.stage,
      namePrefix: props.namePrefix,
      agentName: this.agentName,
    });

    const environmentVariables: Record<string, string> = {
      UPLOADS_BUCKET: props.uploadsBucket.bucketName,
      REGISTRY_SOURCE: 's3-yaml',
      KB_ID: props.kb.kbId,
      MEMORY_ID: this.memory.memory.memoryId,
      MEMORY_NS_FACTS: this.memory.namespaceFacts,
      MEMORY_NS_PREFERENCES: this.memory.namespacePreferences,
      MEMORY_NS_SUMMARY: this.memory.namespaceSummary,
    };
    if (props.kb.webDataSource) {
      environmentVariables.KB_WEB_DATA_SOURCE_ID = props.kb.webDataSource.attrDataSourceId;
    }

    this.runtime = new AgentcoreRuntime(this, 'Runtime', {
      namePrefix: props.namePrefix,
      agentName: this.agentName,
      stage: props.stage,
      dockerAssetPath: props.dockerAssetPath,
      dockerfile: props.dockerfile,
      environmentVariables,
      kbRetrieveAccess: props.kb,
      uploadsBucketReadAccess: {
        bucket: props.uploadsBucket,
        prefixes: props.uploadsBucketReadPrefixes,
      },
      memoryAccess: this.memory,
    });
  }
}
