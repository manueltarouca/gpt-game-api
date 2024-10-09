import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ddbDocClient } from './utils/ddbClient';
import { GetCommand, PutCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAME } from './utils/constants';

export const handleEnvironment = async (
  event: APIGatewayProxyEvent,
  pathSegments: string[]
): Promise<APIGatewayProxyResult> => {
  const { httpMethod } = event;

  if (httpMethod === 'POST' && pathSegments[0] === 'interact') {
    const body = JSON.parse(event.body || '{}');
    const { characterId, objectName, action, objectDescription } = body;

    if (!characterId || !objectName || !action) {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: 'characterId, objectName, and action are required' }),
      };
    }

    const character = await getCharacter(characterId);
    if (!character) {
      return {
        statusCode: 404,
        body: JSON.stringify({ message: 'Character not found' }),
      };
    }
    const locationId = character.locationId;

    const objectId = generateObjectId(objectName, locationId);

    let object = await getObjectDetails(objectId);

    if (!object) {
      object = await createNewObject(objectId, objectName, locationId, action, character.name, objectDescription);
    }

    const result = await processInteraction(character.name, object, action);

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } else {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Invalid environment request' }),
    };
  }
};

const getCharacter = async (characterId: string) => {
  const result = await ddbDocClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `CHARACTER#${characterId}`,
        SK: `#PROFILE#${characterId}`,
      },
    })
  );
  return result.Item;
};

const generateObjectId = (objectName: string, locationId: string): string => {
  return `${locationId}#${objectName.toLowerCase().replace(/\s+/g, '_')}`;
};

const getObjectDetails = async (objectId: string) => {
  const result = await ddbDocClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `OBJECT#${objectId}`,
        SK: `#DETAILS#${objectId}`,
      },
    })
  );
  return result.Item;
};

const createNewObject = async (
  objectId: string,
  objectName: string,
  locationId: string,
  action: string,
  characterName: string,
  objectDescription: string
) => {
  const newObject = {
    PK: `OBJECT#${objectId}`,
    SK: `#DETAILS#${objectId}`,
    entityType: 'Object',
    objectId,
    name: objectName,
    description: objectDescription,
    locationId,
    state: 'default',
    actionLog: [generateActionLog(objectName, locationId, characterName, action)],
  };

  await ddbDocClient.send(
    new PutCommand({
      TableName: TABLE_NAME,
      Item: newObject,
    })
  );

  return newObject;
};

const generateActionLog = (objectName: string, locationId: string, characterName: string, action: string): string => {
  return `A ${objectName} located at ${locationId}. ${characterName} used the action ${action} on it.`;
};

const processInteraction = async (characterId: string, object: any, action: string) => {
  const actionLog = object.actionLog || [];
  const resultMessage = `You ${action} the ${object.name}. Something changes...`;
  actionLog.push(generateActionLog(object.name, object.locationId, characterId, action));
  await updateObjectState(object.objectId, actionLog);

  return {
    result: resultMessage,
    object: { ...object },
  };
};

const updateObjectState = async (objectId: string, newActionLog: string) => {
  await ddbDocClient.send(
    new UpdateCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `OBJECT#${objectId}`,
        SK: `#DETAILS#${objectId}`,
      },
      UpdateExpression: 'SET #actionLog = :newActionLog',
      ExpressionAttributeNames: {
        '#actionLog': 'actionLog',
      },
      ExpressionAttributeValues: {
        ':newActionLog': newActionLog,
      },
    })
  );
};
