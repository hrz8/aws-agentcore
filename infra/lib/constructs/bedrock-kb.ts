import type { Stage } from '../config.js';

import { CfnOutput, RemovalPolicy, Stack } from 'aws-cdk-lib';
import * as bedrock from 'aws-cdk-lib/aws-bedrock';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3vectors from 'aws-cdk-lib/aws-s3vectors';
import { Construct } from 'constructs';

import { Stages } from '../config.js';
import { validateSlug } from '../helpers.js';

export const SLUG_REGEX = /^[a-z][a-z0-9-]{0,16}[a-z0-9]$/;

export const TITAN_V2_MODEL_ID = 'amazon.titan-embed-text-v2:0';
export const TITAN_V2_DIMENSIONS = 1024;

export type EmbeddingConfig = {
  readonly modelArn: string;
  readonly dimensions: number;
  readonly dataType: 'FLOAT32';
  readonly similarityMetric: 'COSINE' | 'EUCLIDEAN';
};

export type ChunkingConfig = {
  readonly strategy: 'FIXED_SIZE';
  readonly maxTokens: number;
  readonly overlapPercentage: number;
};

export const DEFAULT_CHUNKING_CONFIG: ChunkingConfig = {
  strategy: 'FIXED_SIZE',
  maxTokens: 300,
  overlapPercentage: 20,
};

export type WebCrawlerConfig = {
  readonly seedUrls: string[];
  readonly scope?: 'HOST_ONLY' | 'SUBDOMAINS';
  readonly inclusionFilters?: string[];
  readonly exclusionFilters?: string[];
  readonly maxPages?: number;
  readonly rateLimit?: number;
};

export type BedrockKnowledgeBaseProps = {
  readonly namePrefix: string;
  readonly stage: Stage;
  readonly docsBucket: s3.IBucket;
  readonly s3InclusionPrefix?: string;
  readonly embeddingConfig?: EmbeddingConfig;
  readonly chunkingConfig?: ChunkingConfig;
  readonly webCrawler?: WebCrawlerConfig;
  readonly customWebDataSource?: boolean;
  readonly description?: string;
};

export class BedrockKnowledgeBase extends Construct {
  static defaultEmbeddingConfig(region: string): EmbeddingConfig {
    return {
      modelArn: `arn:aws:bedrock:${region}::foundation-model/${TITAN_V2_MODEL_ID}`,
      dimensions: TITAN_V2_DIMENSIONS,
      dataType: 'FLOAT32',
      similarityMetric: 'COSINE',
    };
  }

  readonly knowledgeBase: bedrock.CfnKnowledgeBase;
  readonly kbId: string;
  readonly kbArn: string;
  readonly docsBucket: s3.IBucket;
  readonly kbRole: iam.Role;
  readonly vectorBucket: s3vectors.CfnVectorBucket;
  readonly vectorIndex: s3vectors.CfnIndex;
  readonly s3DataSource: bedrock.CfnDataSource;
  readonly webDataSource?: bedrock.CfnDataSource;

  constructor(scope: Construct, id: string, props: BedrockKnowledgeBaseProps) {
    super(scope, id);

    validateSlug('namePrefix', props.namePrefix, SLUG_REGEX);

    const stack = Stack.of(this);
    const isProd = props.stage === Stages.Prod;
    const stageLower = props.stage.toLowerCase();
    const accountId = stack.account;
    const region = stack.region;

    const baseName = `${props.namePrefix}-${stageLower}`;
    const embedding = props.embeddingConfig ?? BedrockKnowledgeBase.defaultEmbeddingConfig(region);
    const defaultChunking = props.chunkingConfig ?? DEFAULT_CHUNKING_CONFIG;

    this.docsBucket = props.docsBucket;

    this.vectorBucket = new s3vectors.CfnVectorBucket(this, 'VectorBucket', {
      vectorBucketName: `${props.namePrefix}-vec-${stageLower}-${accountId}`,
      encryptionConfiguration: { sseType: 'AES256' },
    });
    this.vectorBucket.applyRemovalPolicy(isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY);

    this.vectorIndex = new s3vectors.CfnIndex(this, 'VectorIndex', {
      indexName: `${props.namePrefix}-idx`,
      vectorBucketName: this.vectorBucket.vectorBucketName!,
      dataType: embedding.dataType.toLowerCase(),
      dimension: embedding.dimensions,
      distanceMetric: embedding.similarityMetric.toLowerCase(),
      metadataConfiguration: {
        nonFilterableMetadataKeys: [
          'AMAZON_BEDROCK_TEXT',
          'AMAZON_BEDROCK_METADATA',
          'x-amz-bedrock-kb-source-uri',
          'x-amz-bedrock-kb-chunk-id',
          'x-amz-bedrock-kb-document-page-number',
        ],
      },
    });
    this.vectorIndex.addDependency(this.vectorBucket);
    this.vectorIndex.applyRemovalPolicy(isProd ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY);

    this.kbRole = new iam.Role(this, 'KbRole', {
      roleName: `${baseName}-kb-role`,
      assumedBy: new iam.ServicePrincipal('bedrock.amazonaws.com', {
        conditions: {
          StringEquals: { 'aws:SourceAccount': accountId },
          ArnLike: {
            'aws:SourceArn': `arn:aws:bedrock:${region}:${accountId}:knowledge-base/*`,
          },
        },
      }),
    });

    this.kbRole.addToPolicy(new iam.PolicyStatement({
      sid: 'BedrockInvokeEmbeddingModel',
      actions: ['bedrock:InvokeModel'],
      resources: [embedding.modelArn],
    }));

    this.docsBucket.grantRead(this.kbRole);

    this.kbRole.addToPolicy(new iam.PolicyStatement({
      sid: 'S3VectorsIndexAccess',
      actions: [
        's3vectors:GetIndex',
        's3vectors:PutVectors',
        's3vectors:GetVectors',
        's3vectors:QueryVectors',
        's3vectors:DeleteVectors',
        's3vectors:ListVectors',
      ],
      resources: [
        `arn:aws:s3vectors:${region}:${accountId}:bucket/${this.vectorBucket.vectorBucketName!}`,
        `arn:aws:s3vectors:${region}:${accountId}:bucket/${this.vectorBucket.vectorBucketName!}/index/*`,
      ],
    }));

    this.knowledgeBase = new bedrock.CfnKnowledgeBase(this, 'KnowledgeBase', {
      name: `${baseName}-kb`,
      description: props.description ?? `KB ${baseName} (${props.stage})`,
      roleArn: this.kbRole.roleArn,
      knowledgeBaseConfiguration: {
        type: 'VECTOR',
        vectorKnowledgeBaseConfiguration: {
          embeddingModelArn: embedding.modelArn,
          embeddingModelConfiguration: {
            bedrockEmbeddingModelConfiguration: {
              dimensions: embedding.dimensions,
              embeddingDataType: embedding.dataType,
            },
          },
        },
      },
      storageConfiguration: {
        type: 'S3_VECTORS',
        s3VectorsConfiguration: {
          indexArn: this.vectorIndex.attrIndexArn,
        },
      },
    });
    this.knowledgeBase.addDependency(this.vectorIndex);

    // Bedrock validates s3vectors permissions at KB-create time; the inline
    // policy must attach before the KB resource is created.
    const defaultPolicy = this.kbRole.node.tryFindChild('DefaultPolicy');
    if (defaultPolicy) {
      this.knowledgeBase.node.addDependency(defaultPolicy);
    }

    this.kbId = this.knowledgeBase.attrKnowledgeBaseId;
    this.kbArn = this.knowledgeBase.attrKnowledgeBaseArn;

    const chunkingConfiguration = renderChunkingConfiguration(defaultChunking);

    this.s3DataSource = new bedrock.CfnDataSource(this, 'S3DataSource', {
      knowledgeBaseId: this.kbId,
      name: 'docs',
      dataSourceConfiguration: {
        type: 'S3',
        s3Configuration: {
          bucketArn: this.docsBucket.bucketArn,
          ...(props.s3InclusionPrefix
            ? { inclusionPrefixes: [props.s3InclusionPrefix] }
            : {}),
        },
      },
      vectorIngestionConfiguration: { chunkingConfiguration },
    });

    if (props.webCrawler && props.customWebDataSource) {
      throw new Error('webCrawler and customWebDataSource are mutually exclusive');
    }

    if (props.customWebDataSource) {
      this.webDataSource = new bedrock.CfnDataSource(this, 'WebDataSource', {
        knowledgeBaseId: this.kbId,
        name: 'web',
        dataSourceConfiguration: { type: 'CUSTOM' },
        vectorIngestionConfiguration: { chunkingConfiguration },
      });
    } else if (props.webCrawler && props.webCrawler.seedUrls.length > 0) {
      const wc = props.webCrawler;
      this.webDataSource = new bedrock.CfnDataSource(this, 'WebDataSource', {
        knowledgeBaseId: this.kbId,
        name: 'web',
        dataSourceConfiguration: {
          type: 'WEB',
          webConfiguration: {
            sourceConfiguration: {
              urlConfiguration: { seedUrls: wc.seedUrls.map(url => ({ url })) },
            },
            crawlerConfiguration: {
              scope: wc.scope ?? 'HOST_ONLY',
              ...(wc.inclusionFilters ? { inclusionFilters: wc.inclusionFilters } : {}),
              ...(wc.exclusionFilters ? { exclusionFilters: wc.exclusionFilters } : {}),
              ...(wc.maxPages != null || wc.rateLimit != null
                ? {
                    crawlerLimits: {
                      ...(wc.maxPages != null ? { maxPages: wc.maxPages } : {}),
                      ...(wc.rateLimit != null ? { rateLimit: wc.rateLimit } : {}),
                    },
                  }
                : {}),
            },
          },
        },
        vectorIngestionConfiguration: { chunkingConfiguration },
      });
    }

    new CfnOutput(stack, `${id}Id`, {
      value: this.kbId,
      description: `Bedrock KB id (${id})`,
    });
    new CfnOutput(stack, `${id}Arn`, {
      value: this.kbArn,
      description: `Bedrock KB ARN (${id})`,
    });
    new CfnOutput(stack, `${id}S3DataSourceId`, {
      value: this.s3DataSource.attrDataSourceId,
      description: `Bedrock KB S3 data source id (${id})`,
    });
    if (this.webDataSource) {
      new CfnOutput(stack, `${id}WebDataSourceId`, {
        value: this.webDataSource.attrDataSourceId,
        description: `Bedrock KB Web data source id (${id})`,
      });
    }
  }

  grantRetrieve(principal: iam.IGrantable): iam.Grant {
    return iam.Grant.addToPrincipal({
      grantee: principal,
      actions: ['bedrock:Retrieve'],
      resourceArns: [this.kbArn],
    });
  }
}

function renderChunkingConfiguration(
  cfg: ChunkingConfig,
): bedrock.CfnDataSource.ChunkingConfigurationProperty {
  return {
    chunkingStrategy: cfg.strategy,
    fixedSizeChunkingConfiguration: {
      maxTokens: cfg.maxTokens,
      overlapPercentage: cfg.overlapPercentage,
    },
  };
}
