import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ddbDocClient } from './utils/ddbClient';
import { GetCommand, PutCommand, QueryCommand, QueryCommandInput, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAME } from './utils/constants';

export const handleExplore = async (event: APIGatewayProxyEvent, pathSegments: string[]): Promise<APIGatewayProxyResult> => {
  const { httpMethod } = event;

  if (httpMethod === 'POST' && pathSegments[0] === 'move') {
    const body = JSON.parse(event.body || '{}');
    const { characterId, locationName, description } = body;

    if (!characterId || !locationName || !description) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'characterId and locationName are required' }),
      };
    }

    const locationId = generateLocationId(locationName);

    let location = await getLocationDetails(locationId);

    if (!location) {
      location = await createNewLocation(locationId, locationName, description);
    }

    await ddbDocClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `CHARACTER#${characterId}`,
          SK: `#PROFILE#${characterId}`,
        },
        UpdateExpression: 'SET locationId = :locationId',
        ExpressionAttributeValues: {
          ':locationId': locationId,
        },
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify(location),
    };
  } else if (httpMethod === 'GET' && pathSegments[0] === 'state') {
    const characterId = event.queryStringParameters?.characterId;

    if (!characterId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'characterId is required' }),
      };
    }

    const character = await ddbDocClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `CHARACTER#${characterId}`,
          SK: `#PROFILE#${characterId}`,
        },
      })
    );

    if (!character.Item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Character not found' }),
      };
    }

    const locationId = character.Item.locationId;
    const objects = await getObjectsNearby(locationId);
    const characters = await getCharactersNearby(locationId);

    return {
      statusCode: 200,
      body: JSON.stringify({
        objects,
        characters,
      }),
    };
  } else {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Invalid explore request' }),
    };
  }
};

const generateLocationId = (locationName: string): string => {
  return locationName.toLowerCase().replace(/\s+/g, '_');
};

const getLocationDetails = async (locationId: string) => {
  const result = await ddbDocClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `LOCATION#${locationId}`,
        SK: `#DETAILS#${locationId}`,
      },
    })
  );
  return result.Item;
};

const createNewLocation = async (locationId: string, locationName: string, description: string) => {
  const newLocation = {
    PK: `LOCATION#${locationId}`,
    SK: `#DETAILS#${locationId}`,
    entityType: 'Location',
    locationId,
    name: locationName,
    description: description,
  };

  await ddbDocClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: newLocation,
    })
  );

  return newLocation;
};

const getObjectsNearby = async (locationId: string) => {
  const params: QueryCommandInput = {
    TableName: TABLE_NAME,
    IndexName: 'EntityTypeIndex',
    KeyConditionExpression: 'entityType = :type',
    FilterExpression: 'locationId = :locationId',
    ExpressionAttributeValues: {
      ':type': 'Object',
      ':locationId': locationId,
    },
  };

  const result = await ddbDocClient.send(new QueryCommand(params));
  return result.Items;
};

const getCharactersNearby = async (locationId: string) => {
  const params: QueryCommandInput = {
    TableName: TABLE_NAME,
    IndexName: 'EntityTypeIndex',
    KeyConditionExpression: 'entityType = :type',
    FilterExpression: 'locationId = :locationId',
    ExpressionAttributeValues: {
      ':type': 'Character',
      ':locationId': locationId,
    },
  };

  const result = await ddbDocClient.send(new QueryCommand(params));
  return result.Items;
};
