import {
  BedrockAgentClient,
  GetIngestionJobCommand,
  StartIngestionJobCommand,
  type IngestionJob,
} from '@aws-sdk/client-bedrock-agent';

import { AWS_REGION } from '../../../config.js';

const client = new BedrockAgentClient({ region: AWS_REGION });

export type IngestionJobSummary = {
  ingestionJobId: string | undefined;
  status: IngestionJob['status'];
  statistics?: IngestionJob['statistics'];
  failureReasons?: string[];
};

export async function startIngestionJob(
  knowledgeBaseId: string,
  dataSourceId: string,
): Promise<IngestionJobSummary> {
  const out = await client.send(new StartIngestionJobCommand({
    knowledgeBaseId,
    dataSourceId,
  }));
  return toSummary(out.ingestionJob);
}

export async function getIngestionJob(
  knowledgeBaseId: string,
  dataSourceId: string,
  ingestionJobId: string,
): Promise<IngestionJobSummary> {
  const out = await client.send(new GetIngestionJobCommand({
    knowledgeBaseId,
    dataSourceId,
    ingestionJobId,
  }));
  return toSummary(out.ingestionJob);
}

function toSummary(job: IngestionJob | undefined): IngestionJobSummary {
  return {
    ingestionJobId: job?.ingestionJobId,
    status: job?.status,
    statistics: job?.statistics,
    failureReasons: job?.failureReasons,
  };
}
