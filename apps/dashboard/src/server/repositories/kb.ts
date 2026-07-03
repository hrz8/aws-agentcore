import { S3BedrockKbRepository, WebIngestService, type KbRepository } from '@repo/kb';

import { getLogger } from '@repo/kit/logger';

import { AWS_REGION, KB_STAGE } from '#/server/config';

let kbSingleton: KbRepository | null = null;
let webIngestSingleton: WebIngestService | null = null;

export function getKbRepo(): KbRepository {
  if (kbSingleton) {
    return kbSingleton;
  }
  if (!KB_STAGE) {
    throw new Error('KB stage not configured');
  }
  kbSingleton = new S3BedrockKbRepository({
    region: AWS_REGION,
    uploadsBucket: KB_STAGE.uploadsBucket,
    kbId: KB_STAGE.kbId,
    s3DataSourceId: KB_STAGE.s3DataSourceId,
    webDataSourceId: KB_STAGE.webDataSourceId ?? null,
    logger: getLogger().child({ context: 'kb' }),
  });
  return kbSingleton;
}

export function getWebIngestService(): WebIngestService {
  if (webIngestSingleton) {
    return webIngestSingleton;
  }
  webIngestSingleton = new WebIngestService(getKbRepo(), {
    logger: getLogger().child({ context: 'kb.web-ingest' }),
  });
  return webIngestSingleton;
}
