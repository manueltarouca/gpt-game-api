import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TABLE_NAME } from './utils/constants';
import { ddbDocClient } from './utils/ddbClient';

export const handleProfile = async (event: APIGatewayProxyEvent, pathSegments: string[]): Promise<APIGatewayProxyResult> => {
  const { httpMethod } = event;

  if (httpMethod === 'POST' && pathSegments[0] === 'journal') {
    const body = JSON.parse(event.body || '{}');
    const { characterId, entry } = body;

    const timestamp = Date.now();

    const item = {
      PK: `CHARACTER#${characterId}`,
      SK: `#JOURNAL#${timestamp}`,
      entityType: 'JournalEntry',
      entry,
      timestamp,
    };

    await ddbDocClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: item,
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Journal entry added' }),
    };
  } else if (httpMethod === 'GET' && pathSegments[0] === 'journal') {
    const characterId = event.queryStringParameters?.characterId;

    if (!characterId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'characterId is required' }),
      };
    }

    const entries = await getJournalEntries(characterId);

    return {
      statusCode: 200,
      body: JSON.stringify(entries),
    };
  } else {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Invalid profile request' }),
    };
  }
};

const getJournalEntries = async (characterId: string) => {
  const params = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': `CHARACTER#${characterId}`,
      ':skPrefix': '#JOURNAL#',
    },
  };

  const result = await ddbDocClient.send(new QueryCommand(params));
  return result.Items;
};
