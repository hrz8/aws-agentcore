import type { StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';

import type { Stage } from './config.js';

import * as path from 'node:path';
import { Stack } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';

import { AgentcoreRuntime } from './constructs/agentcore-runtime.js';
import { BedrockKnowledgeBase } from './constructs/bedrock-kb.js';
import { UploadsBucket } from './constructs/uploads-bucket.js';

const STACK_NAME = 'DemoAgentcoreStack';
const NAME_PREFIX = 'demoagent';
const AGENTS_INCLUSION_PREFIX = 'agents/';

export type DemoAgentcoreStackProps = StackProps & {
  readonly stage: Stage;
};

export class DemoAgentcoreStack extends Stack {
  readonly runtime: AgentcoreRuntime;
  readonly uploadsBucket: UploadsBucket;
  readonly kb: BedrockKnowledgeBase;

  constructor(scope: Construct, props: DemoAgentcoreStackProps) {
    super(scope, STACK_NAME, props);

    const { stage } = props;

    const agentDir = path.resolve(__dirname, '..', '..', 'agent');

    this.uploadsBucket = new UploadsBucket(this, 'UploadsBucket', {
      namePrefix: NAME_PREFIX,
      stage,
    });

    this.kb = new BedrockKnowledgeBase(this, 'Kb', {
      namePrefix: NAME_PREFIX,
      stage,
      docsBucket: this.uploadsBucket.bucket,
      s3InclusionPrefix: AGENTS_INCLUSION_PREFIX,
    });

    const environmentVariables: Record<string, string> = {
      // ---- Agent-scoped ----
      MODEL_PROVIDER: 'bedrock',
      BEDROCK_MODEL_ID: 'us.amazon.nova-lite-v1:0',
      AGENT_ID: 'demo-agent',
      KB_AGENT_S3_PREFIX_TEMPLATE: `s3://${this.uploadsBucket.bucket.bucketName}/${AGENTS_INCLUSION_PREFIX}{agentId}/`,

      // ---- KB — global ----
      KB_ID: this.kb.kbId,
      KB_DOCS_BUCKET: this.uploadsBucket.bucket.bucketName,
      KB_S3_DATA_SOURCE_ID: this.kb.s3DataSource.attrDataSourceId,
    };
    if (this.kb.webDataSource) {
      environmentVariables.KB_WEB_DATA_SOURCE_ID = this.kb.webDataSource.attrDataSourceId;
    }

    this.runtime = new AgentcoreRuntime(this, 'DemoAgentRuntime', {
      agentName: 'DemoAgent',
      stage,
      dockerAssetPath: agentDir,
      dockerfile: 'Dockerfile',
      environmentVariables,
    });

    this.runtime.runtime.addToRolePolicy(new iam.PolicyStatement({
      sid: 'BedrockRetrieveOnSharedKb',
      actions: ['bedrock:Retrieve'],
      resources: [this.kb.kbArn],
    }));
  }
}
