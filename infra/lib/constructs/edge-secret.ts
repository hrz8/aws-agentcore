import { SecretValue } from 'aws-cdk-lib';
import { Construct } from 'constructs';

import { type Stage } from '../config.js';

export type EdgeSecretProps = {
  readonly namePrefix: string;
  readonly stage: Stage;
  readonly componentName: string;
};

export class EdgeSecret extends Construct {
  readonly secretName: string;

  constructor(scope: Construct, id: string, props: EdgeSecretProps) {
    super(scope, id);

    const { namePrefix, stage, componentName } = props;
    this.secretName = `/${namePrefix}/${stage.toLowerCase()}/${componentName}`;
  }

  get originSecretValue(): string {
    return SecretValue.secretsManager(this.secretName, { jsonField: 'ORIGIN_SECRET' }).unsafeUnwrap();
  }
}
