import { CfnOutput, RemovalPolicy, Stack } from 'aws-cdk-lib';
import * as ddb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

import { Stages, type Stage } from '../config.js';

export type ThreadTableProps = {
  readonly namePrefix: string;
  readonly stage: Stage;
};

export class ThreadTable extends Construct {
  readonly table: ddb.Table;

  constructor(scope: Construct, id: string, props: ThreadTableProps) {
    super(scope, id);

    const { namePrefix, stage } = props;
    const isProd = stage === Stages.Prod;
    const tableName = `${namePrefix}-threads-${stage.toLowerCase()}-${Stack.of(this).account}`;

    this.table = new ddb.Table(this, 'Table', {
      tableName,
      partitionKey: { name: 'threadKey', type: ddb.AttributeType.STRING },
      sortKey: { name: 'SK', type: ddb.AttributeType.STRING },
      billingMode: ddb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: 'expiresAt',
      pointInTimeRecoverySpecification: isProd
        ? { pointInTimeRecoveryEnabled: true }
        : undefined,
      removalPolicy: isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    new CfnOutput(this, 'Name', {
      value: this.table.tableName,
      description: 'Middleware thread table name',
      exportName: `${stage}-${namePrefix}-ThreadTableName`,
    });
  }
}
