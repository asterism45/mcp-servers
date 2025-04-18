#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

const API_KEY = process.env.RAPIDAPI_KEY;
if (!API_KEY) {
  throw new Error('RAPIDAPI_KEY environment variable is required');
}

interface RouteTransitArgs {
  start: string;
  goal: string;
  start_time?: string;
  term?: string;
  limit?: string;
  datum?: string;
  coord_unit?: string;
}

const isValidRouteTransitArgs = (args: any): args is RouteTransitArgs => {
  return (
    typeof args === 'object' &&
    args !== null &&
    typeof args.start === 'string' &&
    typeof args.goal === 'string' &&
    (args.start_time === undefined || typeof args.start_time === 'string') &&
    (args.term === undefined || typeof args.term === 'string') &&
    (args.limit === undefined || typeof args.limit === 'string') &&
    (args.datum === undefined || typeof args.datum === 'string') &&
    (args.coord_unit === undefined || typeof args.coord_unit === 'string')
  );
};

class NavitimeTransitServer {
  private server: Server;
  private axiosInstance;

  constructor() {
    this.server = new Server(
      {
        name: 'navitime-transit-server',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.axiosInstance = axios.create({
      baseURL: 'https://navitime-route-totalnavi.p.rapidapi.com',
      headers: {
        'x-rapidapi-key': API_KEY,
        'x-rapidapi-host': 'navitime-route-totalnavi.p.rapidapi.com'
      }
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
          name: 'route_transit',
          description: '指定した出発地から目的地までの公共交通機関での経路を探索します',
          inputSchema: {
            type: 'object',
            properties: {
              start: {
                type: 'string',
                description: '出発地の座標（緯度,経度）',
              },
              goal: {
                type: 'string',
                description: '目的地の座標（緯度,経度）',
              },
              start_time: {
                type: 'string',
                description: '出発時刻（ISO 8601形式）',
              },
              term: {
                type: 'string',
                description: '探索対象時間（分）',
              },
              limit: {
                type: 'string',
                description: '取得する経路数',
              },
              datum: {
                type: 'string',
                description: '測地系（wgs84/tokyo）',
              },
              coord_unit: {
                type: 'string',
                description: '座標の単位（degree/minute）',
              },
            },
            required: ['start', 'goal'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== 'route_transit') {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }

      if (!isValidRouteTransitArgs(request.params.arguments)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Invalid route_transit arguments'
        );
      }

      try {
        const normalizeTime = (timeStr: string) => {
          return timeStr.includes('+') ? timeStr : timeStr + '+09:00';
        };
        const startTime = request.params.arguments.start_time
          ? normalizeTime(request.params.arguments.start_time)
          : '2024-02-11T12:00:00+09:00';
        const response = await this.axiosInstance.get('/route_transit', {
          params: {
            start: request.params.arguments.start,
            goal: request.params.arguments.goal,
            start_time: startTime,
            term: request.params.arguments.term || '60',
            limit: request.params.arguments.limit || '3',
            datum: request.params.arguments.datum || 'wgs84',
            coord_unit: request.params.arguments.coord_unit || 'degree'
          }
        });

        // Transform the API response to match the reference output format.
        const data = response.data;
        const addTimezone = (timeStr: string) => {
          return timeStr.includes('+') ? timeStr : timeStr + '+09:00';
        };
        if(data.items && Array.isArray(data.items)){
          data.items = data.items.map((item: any) => {
            if(item.summary && item.summary.move){
              item.summary.move.from_time = addTimezone(item.summary.move.from_time);
              item.summary.move.to_time = addTimezone(item.summary.move.to_time);
            }
            if(item.sections && Array.isArray(item.sections)){
              item.sections = item.sections.map((section: any) => {
                if(section.type === 'move'){
                  if(section.from_time) section.from_time = addTimezone(section.from_time);
                  if(section.to_time) section.to_time = addTimezone(section.to_time);
                }
                return section;
              });
            }
            return item;
          });
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      } catch (error) {
        if (axios.isAxiosError(error)) {
          return {
            content: [
              {
                type: 'text',
                text: `Navitime API error: ${
                  error.response?.data?.message ?? error.message
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

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Navitime Transit MCP server running on stdio');
  }
}

const server = new NavitimeTransitServer();
server.run().catch(console.error);
