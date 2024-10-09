import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { v7 as uuid } from 'uuid';
import { ddbDocClient } from './utils/ddbClient';
import { PutCommand, GetCommand, UpdateCommand, DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAME } from './utils/constants';

export const handleCharacters = async (
  event: APIGatewayProxyEvent,
  pathSegments: string[]
): Promise<APIGatewayProxyResult> => {
  const { httpMethod } = event;

  if (httpMethod === 'POST' && pathSegments.length === 0) {
    const body = JSON.parse(event.body || '{}');
    const characterId = uuid();

    const newCharacter = {
      characterId,
      name: body.name,
      bio: body.bio,
      locationId: 'starting-location',
    };

    await ddbDocClient.send(
      new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `CHARACTER#${characterId}`,
          SK: `#PROFILE#${characterId}`,
          entityType: 'Character',
          ...newCharacter,
        },
      })
    );

    return {
      statusCode: 201,
      body: JSON.stringify(newCharacter),
    };
  } else if (httpMethod === 'GET' && pathSegments.length === 1) {
    const characterId = pathSegments[0];

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
      return {
        statusCode: 200,
        body: JSON.stringify(result.Item),
      };
    } else {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Character not found' }),
      };
    }
  } else if (httpMethod === 'PUT' && pathSegments.length === 1) {
    const characterId = pathSegments[0];
    const body = JSON.parse(event.body || '{}');

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `CHARACTER#${characterId}`,
          SK: `#PROFILE#${characterId}`,
        },
        UpdateExpression: 'set #name = :name, bio = :bio',
        ExpressionAttributeNames: {
          '#name': 'name',
        },
        ExpressionAttributeValues: {
          ':name': body.name,
          ':bio': body.bio,
        },
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Character updated' }),
    };
  } else if (httpMethod === 'DELETE' && pathSegments.length === 1) {
    const characterId = pathSegments[0];

    await ddbDocClient.send(
      new DeleteCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `CHARACTER#${characterId}`,
          SK: `#PROFILE#${characterId}`,
        },
      })
    );

    return {
      statusCode: 204,
      body: '',
    };
  } else {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Invalid request' }),
    };
  }
};
