import { DynamoDBClient, DynamoDBServiceException } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  GetCommand,
} from '@aws-sdk/lib-dynamodb';

export {
  DynamoDBServiceException,
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  GetCommand,
};

export type CreateDynamoDbClientOptions = {
  region?: string;
  /** Strip undefined values from item maps so callers can spread partial objects. */
  removeUndefinedValues?: boolean;
};

export function createDynamoDbClient(
  options: CreateDynamoDbClientOptions = {},
): DynamoDBDocumentClient {
  const { region, removeUndefinedValues = true } = options;
  return DynamoDBDocumentClient.from(
    new DynamoDBClient({ region }),
    { marshallOptions: { removeUndefinedValues } },
  );
}
