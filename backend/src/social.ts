import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { TABLE_NAME } from './utils/constants';
import { ddbDocClient } from './utils/ddbClient';
import { GetCommand, PutCommand, QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';

export const handleSocial = async (event: APIGatewayProxyEvent, pathSegments: string[]): Promise<APIGatewayProxyResult> => {
  const { httpMethod } = event;

  if (httpMethod === 'POST' && pathSegments[0] === 'message') {
    const body = JSON.parse(event.body || '{}');
    const { characterId, senderName, recipientName, message } = body;

    if (!characterId || !senderName || !recipientName || !message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'characterId, senderName, recipientName, and message are required' }),
      };
    }

    const timestamp = Date.now();

    const item = {
      PK: `CHARACTER#${characterId}`,
      SK: `#MESSAGE#${recipientName}`,
      entityType: 'Message',
      senderName,
      recipientName,
      message,
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
      body: JSON.stringify({ message: 'Message sent successfully' }),
    };
  } else if (httpMethod === 'GET' && pathSegments[0] === 'messages') {
    const characterId = event.queryStringParameters?.characterId;

    if (!characterId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'characterId is required' }),
      };
    }

    const result = await ddbDocClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `CHARACTER#${characterId}`,
          SK: `#PROFILE#${characterId}`,
        },
      })
    );

    if (result.Item) {
      const characterName = result.Item.name;
      const messages = await getMessages(characterName);

      return {
        statusCode: 200,
        body: JSON.stringify(messages),
      };
    } else {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Character not found' }),
      };
    }
  } else {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Invalid social request' }),
    };
  }
};

const getMessages = async (characterName: string) => {
  const params: QueryCommandInput = {
    TableName: TABLE_NAME,
    IndexName: 'EntityTypeIndex',
    KeyConditionExpression: 'entityType = :type',
    FilterExpression: 'recipientName = :recipientName',
    ExpressionAttributeValues: {
      ':type': 'Message',
      ':recipientName': characterName,
    },
  };

  const result = await ddbDocClient.send(new QueryCommand(params));
  return result.Items;
};
