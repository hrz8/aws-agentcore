import { createS3Client } from '@repo/kit/aws/s3';
import { createBedrockAgentRuntimeClient } from '@repo/kit/aws/bedrock-runtime';

import { AWS_REGION } from '../config.js';

export const s3 = createS3Client(AWS_REGION);
export const bedrockRuntime = createBedrockAgentRuntimeClient(AWS_REGION);
