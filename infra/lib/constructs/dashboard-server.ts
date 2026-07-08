import { CfnOutput, Duration, RemovalPolicy, Stack } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import type * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

import { Stages, type Stage } from '../config.js';
import type { BedrockKnowledgeBase } from './bedrock-kb.js';

export type DashboardServerProps = {
  readonly namePrefix: string;
  readonly stage: Stage;
  readonly serverAssetPath: string;
  readonly uploadsBucket: s3.IBucket;
  readonly kb: BedrockKnowledgeBase;
  readonly widgetDemoUrl: string;
};

export class DashboardServer extends Construct {
  readonly fn: lambda.Function;

  constructor(scope: Construct, id: string, props: DashboardServerProps) {
    super(scope, id);

    const { namePrefix, stage, serverAssetPath, uploadsBucket, kb, widgetDemoUrl } = props;
    const stack = Stack.of(this);
    const stageLower = stage.toLowerCase();
    const isProd = stage === Stages.Prod;

    const environment: Record<string, string> = {
      NODE_ENV: 'production',
      UPLOADS_BUCKET: uploadsBucket.bucketName,
      KB_ID: kb.kbId,
      KB_S3_DATA_SOURCE_ID: kb.s3DataSource.attrDataSourceId,
      REGISTRY_SOURCE: 's3-yaml',
      REGISTRY_S3_KEY: 'registry/agents.yaml',
      LOG_PRETTY: 'false',
      WIDGET_DEMO_URL: widgetDemoUrl,
    };
    if (kb.webDataSource) {
      environment.KB_WEB_DATA_SOURCE_ID = kb.webDataSource.attrDataSourceId;
    }

    const functionName = `${namePrefix}-dashboard-${stageLower}`;

    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    this.fn = new lambda.Function(this, 'Fn', {
      functionName,
      runtime: lambda.Runtime.NODEJS_24_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(serverAssetPath),
      memorySize: 2048,
      timeout: Duration.seconds(60),
      tracing: lambda.Tracing.ACTIVE,
      environment,
      logGroup,
    });

    this.fn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'DashboardS3ObjectAccess',
      actions: ['s3:GetObject', 's3:PutObject', 's3:DeleteObject'],
      resources: [
        `${uploadsBucket.bucketArn}/kb/*`,
        `${uploadsBucket.bucketArn}/skills/*`,
        `${uploadsBucket.bucketArn}/registry/*`,
      ],
    }));

    this.fn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'DashboardS3ListBucket',
      actions: ['s3:ListBucket'],
      resources: [uploadsBucket.bucketArn],
      conditions: {
        StringLike: { 's3:prefix': ['kb/*', 'skills/*', 'registry/*'] },
      },
    }));

    this.fn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'DashboardBedrockKbManagement',
      actions: [
        'bedrock:StartIngestionJob',
        'bedrock:GetIngestionJob',
        'bedrock:IngestKnowledgeBaseDocuments',
        'bedrock:DeleteKnowledgeBaseDocuments',
        'bedrock:ListKnowledgeBaseDocuments',
      ],
      resources: [kb.kbArn, `${kb.kbArn}/data-source/*`],
    }));

    new CfnOutput(stack, `${id}Arn`, {
      value: this.fn.functionArn,
      description: `Dashboard server Lambda ARN (${id})`,
    });
  }
}
