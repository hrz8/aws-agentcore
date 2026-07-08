import type { AgentRunner } from '@copilotkit/runtime/v2';
import { InMemoryAgentRunner } from '@copilotkit/runtime/v2';

import {
  AWS_REGION,
  RUN_IN_LAMBDA,
  RUNNER_TYPE,
  RunnerType,
  SQLITE_DB_PATH,
  THREAD_TABLE_NAME,
  THREAD_TTL_DAYS,
  UPLOADS_BUCKET,
} from '../config.js';

export async function createRunner(): Promise<AgentRunner> {
  switch (RUNNER_TYPE) {
    case RunnerType.DynamoDB: {
      if (!THREAD_TABLE_NAME) {
        throw new Error('THREAD_TABLE_NAME is required when RUNNER_TYPE=dynamodb');
      }
      const { DynamoDbRunner } = await import('./dynamodb.js');
      console.info(`[runner] using DynamoDB (table: ${THREAD_TABLE_NAME}, ttl: ${THREAD_TTL_DAYS}d)`);
      return new DynamoDbRunner({
        tableName: THREAD_TABLE_NAME,
        region: AWS_REGION,
        ttlSeconds: THREAD_TTL_DAYS * 86_400,
      });
    }
    case RunnerType.S3: {
      const { S3Runner } = await import('./s3.js');
      if (!UPLOADS_BUCKET) {
        throw new Error('UPLOADS_BUCKET is required when RUNNER_TYPE=s3');
      }
      return new S3Runner({
        bucket: UPLOADS_BUCKET,
        prefix: 'threads',
        region: AWS_REGION,
        ttlSeconds: THREAD_TTL_DAYS * 86_400,
      });
    }
    case RunnerType.Sqlite: {
      const { SqliteRunner } = await import('./sqlite.js');
      console.info(`[runner] using SQLite (path: ${SQLITE_DB_PATH})`);
      return new SqliteRunner({ dbPath: SQLITE_DB_PATH });
    }
    case RunnerType.InMemory: {
      if (RUN_IN_LAMBDA) {
        throw new Error('RUNNER_TYPE=in-memory is not safe in Lambda; set RUNNER_TYPE=dynamodb');
      }
      console.info('[runner] using InMemoryAgentRunner (ephemeral)');
      return new InMemoryAgentRunner();
    }
  }
}
