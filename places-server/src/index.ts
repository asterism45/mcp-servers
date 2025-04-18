#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosResponse } from 'axios';

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!API_KEY) {
  throw new Error('GOOGLE_PLACES_API_KEY environment variable is required');
}

interface PlacesResponse {
  candidates?: any[];
  results?: any[];
  result?: any;
  status: string;
}

class PlacesServer {
  private server: Server;
  private axiosInstance;

  constructor() {
    this.server = new Server(
      {
        name: 'places-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.axiosInstance = axios.create({
      baseURL: 'https://maps.googleapis.com/maps/api/place',
      params: {
        key: API_KEY,
      },
    });

    this.setupToolHandlers();
    
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search_places',
          description: '指定したキーワードで場所を検索します',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: '検索キーワード',
              },
              language: {
                type: 'string',
                description: '結果の言語（例：ja）',
                default: 'ja',
              },
            },
            required: ['query'],
          },
        },
        {
          name: 'get_place_details',
          description: '場所の詳細情報を取得します',
          inputSchema: {
            type: 'object',
            properties: {
              placeId: {
                type: 'string',
                description: '場所のID',
              },
              language: {
                type: 'string',
                description: '結果の言語（例：ja）',
                default: 'ja',
              },
            },
            required: ['placeId'],
          },
        },
        {
          name: 'nearby_search',
          description: '指定した座標の近くにある場所を検索します',
          inputSchema: {
            type: 'object',
            properties: {
              location: {
                type: 'object',
                properties: {
                  lat: { type: 'number' },
                  lng: { type: 'number' },
                },
                required: ['lat', 'lng'],
                description: '中心となる座標',
              },
              radius: {
                type: 'number',
                description: '検索範囲（メートル）',
                default: 1000,
              },
              type: {
                type: 'string',
                description: '場所のタイプ（restaurant, cafe など）',
              },
              language: {
                type: 'string',
                description: '結果の言語（例：ja）',
                default: 'ja',
              },
            },
            required: ['location'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'search_places':
            return await this.handleSearchPlaces(request.params.arguments);
          case 'get_place_details':
            return await this.handleGetPlaceDetails(request.params.arguments);
          case 'nearby_search':
            return await this.handleNearbySearch(request.params.arguments);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        if (axios.isAxiosError(error)) {
          return {
            content: [
              {
                type: 'text',
                text: `Google Places API error: ${
                  error.response?.data?.error_message || error.message
                }`,
              },
            ],
            isError: true,
          };
        }
        throw error;
      }
    });
  }

  private async handleSearchPlaces(args: any) {
    const response: AxiosResponse<PlacesResponse> = await this.axiosInstance.get(
      '/findplacefromtext/json',
      {
        params: {
          input: args.query,
          inputtype: 'textquery',
          language: args.language || 'ja',
          fields: 'formatted_address,name,rating,opening_hours,geometry,place_id',
        },
      }
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async handleGetPlaceDetails(args: any) {
    const response: AxiosResponse<PlacesResponse> = await this.axiosInstance.get(
      '/details/json',
      {
        params: {
          place_id: args.placeId,
          language: args.language || 'ja',
          fields: 'name,rating,formatted_phone_number,formatted_address,opening_hours,website,reviews,price_level,photos',
        },
      }
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  private async handleNearbySearch(args: any) {
    const response: AxiosResponse<PlacesResponse> = await this.axiosInstance.get(
      '/nearbysearch/json',
      {
        params: {
          location: `${args.location.lat},${args.location.lng}`,
          radius: args.radius || 1000,
          type: args.type,
          language: args.language || 'ja',
        },
      }
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response.data, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Places MCP server running on stdio');
  }
}

const server = new PlacesServer();
server.run().catch(console.error);