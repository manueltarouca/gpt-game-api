import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handleCharacters } from './character';
import { handleEnvironment } from './environment';
import { handleExplore } from './explore';
import { handleProfile } from './profile';
import { handleSocial } from './social';
import { handleNarrative } from './narrative';
import { handleWorld } from './world';

export const handler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  try {
    const { httpMethod, path } = event;
    const pathSegments = path.split('/').filter(Boolean);

    switch (pathSegments[0]) {
      case 'characters':
        return await handleCharacters(event, pathSegments.slice(1));
      case 'explore':
        return await handleExplore(event, pathSegments.slice(1));
      case 'environment':
        return await handleEnvironment(event, pathSegments.slice(1));
      case 'social':
        return await handleSocial(event, pathSegments.slice(1));
      case 'narrative':
        return await handleNarrative(event, pathSegments.slice(1));
      case 'profile':
        return await handleProfile(event, pathSegments.slice(1));
      case 'world':
        return await handleWorld(event, pathSegments.slice(1));
      default:
        return {
          statusCode: 404,
          body: JSON.stringify({ message: 'Endpoint not found' }),
        };
    }
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Internal server error' }),
    };
  }
};
