import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { ddbDocClient } from './utils/ddbClient';
import { ScanCommand, QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { TABLE_NAME } from './utils/constants';

export const handleWorld = async (event: APIGatewayProxyEvent, pathSegments: string[]): Promise<APIGatewayProxyResult> => {
  const { httpMethod } = event;

  if (httpMethod === 'GET') {
    switch (pathSegments[0]) {
      case 'locations':
        return await getAllLocations();
      case 'narratives':
        return await getAllNarratives();
      case 'state':
        return await getWorldState();
      default:
        return {
          statusCode: 400,
          body: JSON.stringify({ message: 'Invalid world request' }),
        };
    }
  } else {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: 'Invalid HTTP method for world endpoint' }),
    };
  }
};

const getAllLocations = async (): Promise<APIGatewayProxyResult> => {
  const params: QueryCommandInput = {
    TableName: TABLE_NAME,
    IndexName: 'EntityTypeIndex',
    KeyConditionExpression: 'entityType = :type',
    ExpressionAttributeValues: {
      ':type': 'Location',
    },
  };

  const result = await ddbDocClient.send(new QueryCommand(params));

  return {
    statusCode: 200,
    body: JSON.stringify(result.Items),
  };
};

const getAllNarratives = async (): Promise<APIGatewayProxyResult> => {
  const params = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': 'NARRATIVE',
      ':skPrefix': '#CONTRIBUTION#',
    },
  };

  const result = await ddbDocClient.send(new QueryCommand(params));

  return {
    statusCode: 200,
    body: JSON.stringify(result.Items),
  };
};

const getWorldState = async (): Promise<APIGatewayProxyResult> => {
  const totalPlayersParams: QueryCommandInput = {
    TableName: TABLE_NAME,
    IndexName: 'EntityTypeIndex',
    KeyConditionExpression: 'entityType = :type',
    ExpressionAttributeValues: {
      ':type': 'Character',
    },
    Select: 'COUNT',
  };

  const totalPlayersResult = await ddbDocClient.send(new QueryCommand(totalPlayersParams));

  const totalLocationsParams = {
    ...totalPlayersParams,
    ExpressionAttributeValues: { ':type': 'Location' },
  };

  const totalLocationsResult = await ddbDocClient.send(new QueryCommand(totalLocationsParams));

  const totalObjectsParams = {
    ...totalPlayersParams,
    ExpressionAttributeValues: { ':type': 'Object' },
  };

  const totalObjectsResult = await ddbDocClient.send(new QueryCommand(totalObjectsParams));

  const narrativesParams = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk AND begins_with(SK, :skPrefix)',
    ExpressionAttributeValues: {
      ':pk': 'NARRATIVE',
      ':skPrefix': '#CONTRIBUTION#',
    },
    Limit: 20,
    ScanIndexForward: false, // Get latest contributions
  };

  const narrativesResult = await ddbDocClient.send(new QueryCommand(narrativesParams));

  const worldState = {
    totalPlayers: totalPlayersResult.Count || 0,
    totalLocations: totalLocationsResult.Count || 0,
    totalObjects: totalObjectsResult.Count || 0,
    recentNarratives: narrativesResult.Items || [],
  };

  return {
    statusCode: 200,
    body: JSON.stringify(worldState),
  };
};
