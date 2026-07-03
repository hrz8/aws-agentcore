import type { StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';

import type { Stage } from './config.js';

import * as path from 'node:path';
import { Stack } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';

import { AgentCoreMemory } from './constructs/agentcore-memory.js';
import { AgentcoreRuntime } from './constructs/agentcore-runtime.js';
import { BedrockKnowledgeBase } from './constructs/bedrock-kb.js';
import { UploadsBucket } from './constructs/uploads-bucket.js';

const STACK_NAME = 'DemoAgentcoreStack';
const NAME_PREFIX = 'demoagent';

const KB_PREFIX = 'kb/';
const SKILLS_PREFIX = 'skills/';
const REGISTRY_PREFIX = 'registry/';

export type DemoAgentcoreStackProps = StackProps & {
  readonly stage: Stage;
};

export class DemoAgentcoreStack extends Stack {
  readonly runtime: AgentcoreRuntime;
  readonly uploadsBucket: UploadsBucket;
  readonly kb: BedrockKnowledgeBase;
  readonly memory: AgentCoreMemory;

  constructor(scope: Construct, props: DemoAgentcoreStackProps) {
    super(scope, STACK_NAME, props);

    const { stage } = props;

    const repoRoot = path.resolve(__dirname, '..', '..');

    this.uploadsBucket = new UploadsBucket(this, 'UploadsBucket', {
      namePrefix: NAME_PREFIX,
      stage,
    });

    this.kb = new BedrockKnowledgeBase(this, 'Kb', {
      namePrefix: NAME_PREFIX,
      stage,
      docsBucket: this.uploadsBucket.bucket,
      s3InclusionPrefix: KB_PREFIX,
      customWebDataSource: true,
    });

    this.memory = new AgentCoreMemory(this, 'Memory', { stage });

    const environmentVariables: Record<string, string> = {
      UPLOADS_BUCKET: this.uploadsBucket.bucket.bucketName,
      REGISTRY_SOURCE: 's3-yaml',
      KB_ID: this.kb.kbId,
      MEMORY_ID: this.memory.memory.memoryId,
      MEMORY_NS_FACTS: this.memory.namespaceFacts,
      MEMORY_NS_PREFERENCES: this.memory.namespacePreferences,
      MEMORY_NS_SUMMARY: this.memory.namespaceSummary,
    };
    if (this.kb.webDataSource) {
      environmentVariables.KB_WEB_DATA_SOURCE_ID = this.kb.webDataSource.attrDataSourceId;
    }

    this.runtime = new AgentcoreRuntime(this, 'DemoAgentRuntime', {
      agentName: 'DemoAgent',
      stage,
      dockerAssetPath: repoRoot,
      dockerfile: 'apps/agent/Dockerfile',
      environmentVariables,
    });

    this.runtime.runtime.addToRolePolicy(new iam.PolicyStatement({
      sid: 'BedrockRetrieveOnSharedKb',
      actions: ['bedrock:Retrieve'],
      resources: [this.kb.kbArn],
    }));

    this.runtime.runtime.addToRolePolicy(new iam.PolicyStatement({
      sid: 'S3ReadSkillsAndRegistry',
      actions: ['s3:GetObject'],
      resources: [
        `${this.uploadsBucket.bucket.bucketArn}/${SKILLS_PREFIX}*`,
        `${this.uploadsBucket.bucket.bucketArn}/${REGISTRY_PREFIX}*`,
      ],
    }));
    this.runtime.runtime.addToRolePolicy(new iam.PolicyStatement({
      sid: 'S3ListSkillsAndRegistry',
      actions: ['s3:ListBucket'],
      resources: [this.uploadsBucket.bucket.bucketArn],
      conditions: {
        StringLike: { 's3:prefix': [`${SKILLS_PREFIX}*`, `${REGISTRY_PREFIX}*`] },
      },
    }));

    this.memory.memory.grantWrite(this.runtime.runtime);
    this.memory.memory.grantReadLongTermMemory(this.runtime.runtime);
  }
}
