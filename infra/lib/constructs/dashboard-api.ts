import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import type * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

import { Stages, type Stage } from '../config.js';

export type DashboardApiProps = {
  readonly namePrefix: string;
  readonly stage: Stage;
  readonly serverFn: lambda.IFunction;
};

export class DashboardApi extends Construct {
  readonly api: apigw.LambdaRestApi;

  constructor(scope: Construct, id: string, props: DashboardApiProps) {
    super(scope, id);

    const { namePrefix, stage, serverFn } = props;
    const stageLower = stage.toLowerCase();
    const isProd = stage === Stages.Prod;

    const accessLogs = new logs.LogGroup(this, 'AccessLogs', {
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    this.api = new apigw.LambdaRestApi(this, 'Api', {
      restApiName: `${namePrefix}-dashboard-${stageLower}`,
      handler: serverFn,
      cloudWatchRole: true,
      endpointConfiguration: {
        types: [apigw.EndpointType.REGIONAL],
      },
      integrationOptions: {
        responseTransferMode: apigw.ResponseTransferMode.STREAM,
        timeout: Duration.seconds(60),
      },
      deployOptions: {
        stageName: stageLower,
        metricsEnabled: true,
        tracingEnabled: true,
        accessLogDestination: new apigw.LogGroupLogDestination(accessLogs),
        accessLogFormat: apigw.AccessLogFormat.jsonWithStandardFields({
          caller: false,
          httpMethod: true,
          ip: true,
          protocol: true,
          requestTime: true,
          resourcePath: true,
          responseLength: true,
          status: true,
          user: true,
        }),
      },
    });
  }
}
