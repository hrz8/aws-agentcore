import { CfnOutput, Duration, RemovalPolicy } from 'aws-cdk-lib';
import type * as ddb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import type * as s3 from 'aws-cdk-lib/aws-s3';
import { Construct } from 'constructs';

import { Stages, type Stage } from '../config.js';
import type { Agentcore } from './agentcore.js';

export type MiddlewareServerProps = {
  readonly namePrefix: string;
  readonly stage: Stage;
  readonly serverAssetPath: string;
  readonly uploadsBucket: s3.IBucket;
  readonly threadTable: ddb.ITable;
  readonly agentcore: Agentcore;
  readonly threadTtlDays: number;
};

export class MiddlewareServer extends Construct {
  readonly fn: lambda.Function;

  constructor(scope: Construct, id: string, props: MiddlewareServerProps) {
    super(scope, id);

    const { namePrefix, stage, serverAssetPath, uploadsBucket, threadTable, agentcore, threadTtlDays } = props;
    const isProd = stage === Stages.Prod;
    const functionName = `${namePrefix}-middleware-${stage.toLowerCase()}`;

    const logGroup = new logs.LogGroup(this, 'LogGroup', {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    this.fn = new lambda.Function(this, 'Fn', {
      functionName,
      runtime: lambda.Runtime.NODEJS_24_X,
      architecture: lambda.Architecture.ARM_64,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(serverAssetPath),
      memorySize: 1024,
      timeout: Duration.seconds(60),
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        NODE_ENV: 'production',
        NODE_OPTIONS: '--enable-source-maps',
        RUN_IN_LAMBDA: 'true',
        RUNNER_TYPE: 'dynamodb',
        THREAD_TABLE_NAME: threadTable.tableName,
        THREAD_TTL_DAYS: String(threadTtlDays),
        AGENT_MODE: 'agentcore',
        AGENT_RUNTIME_ARN: agentcore.runtime.runtimeArn,
        REGISTRY_SOURCE: 's3-yaml',
        REGISTRY_S3_KEY: 'registry/agents.yaml',
        UPLOADS_BUCKET: uploadsBucket.bucketName,
      },
      logGroup,
    });

    this.fn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'MiddlewareInvokeAgentRuntime',
      actions: ['bedrock-agentcore:InvokeAgentRuntime'],
      resources: [
        agentcore.runtime.runtimeArn,
        `${agentcore.runtime.runtimeArn}/runtime-endpoint/*`,
      ],
    }));

    this.fn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'MiddlewareRegistryRead',
      actions: ['s3:GetObject'],
      resources: [`${uploadsBucket.bucketArn}/registry/*`],
    }));

    this.fn.addToRolePolicy(new iam.PolicyStatement({
      sid: 'MiddlewareRegistryList',
      actions: ['s3:ListBucket'],
      resources: [uploadsBucket.bucketArn],
      conditions: { StringLike: { 's3:prefix': ['registry/*'] } },
    }));

    threadTable.grantReadWriteData(this.fn);

    new CfnOutput(this, 'Arn', {
      value: this.fn.functionArn,
      description: 'Middleware server Lambda ARN',
    });
  }
}
