import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAME } from './utils/constants';
import { ddbDocClient } from './utils/ddbClient';
import { v7 as uuid } from 'uuid';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';

export const handleNarrative = async (
  event: APIGatewayProxyEvent,
  pathSegments: string[]
): Promise<APIGatewayProxyResult> => {
  const { httpMethod } = event;

  if (httpMethod === 'POST' && pathSegments[0] === 'contribute') {
    const body = JSON.parse(event.body || '{}');
    const { characterId, content } = body;

    const narrativeId = uuid();
    const timestamp = Date.now();

    const item = {
      PK: `NARRATIVE`,
      SK: `#CONTRIBUTION#${timestamp}#${narrativeId}`,
      entityType: 'Narrative',
      narrativeId,
      characterId,
      content,
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
      body: JSON.stringify({ message: 'Contribution accepted' }),
    };
  } else if (httpMethod === 'GET' && pathSegments[0] === 'contributions') {
    const contributions = await getNarratives();

    return {
      statusCode: 200,
      body: JSON.stringify(contributions),
    };
  } else {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Invalid narrative request' }),
    };
  }
};

const getNarratives = async () => {
  const params = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': 'NARRATIVE',
      ':skPrefix': '#CONTRIBUTION#',
    },
  };

  const result = await ddbDocClient.send(new QueryCommand(params));
  return result.Items;
};
