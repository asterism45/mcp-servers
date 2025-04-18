#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ErrorCode, ListResourcesRequestSchema, ListResourceTemplatesRequestSchema, ListToolsRequestSchema, McpError, ReadResourceRequestSchema, } from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
if (!API_KEY) {
    throw new Error('GOOGLE_MAPS_API_KEY environment variable is required');
}
const isValidDirectionsArgs = (args) => {
    return (typeof args === 'object' &&
        args !== null &&
        typeof args.origin === 'string' &&
        typeof args.destination === 'string' &&
        (args.mode === undefined || typeof args.mode === 'string'));
};
class DirectionsServer {
    constructor() {
        this.server = new Server({ name: 'googlemaps-directions-server', version: '0.1.0' }, { capabilities: { resources: {}, tools: {} } });
        this.axiosInstance = axios.create({
            baseURL: 'https://maps.googleapis.com/maps/api/directions/json',
        });
        this.setupResourceHandlers();
        this.setupToolHandlers();
        this.server.onerror = (error) => console.error('[MCP Error]', error);
        process.on('SIGINT', async () => {
            await this.server.close();
            process.exit(0);
        });
    }
    setupResourceHandlers() {
        this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
            resources: [
                {
                    uri: 'directions://ExampleRoute',
                    name: 'Example route directions',
                    mimeType: 'application/json',
                    description: 'Example directions between two locations',
                },
            ],
        }));
        this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
            resourceTemplates: [
                {
                    uriTemplate: 'directions://{origin}/{destination}',
                    name: 'Directions between two locations',
                    mimeType: 'application/json',
                    description: 'Get directions between origin and destination',
                },
            ],
        }));
        this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
            const regex = /^directions:\/\/(.+)\/(.+)$/;
            const match = request.params.uri.match(regex);
            if (!match) {
                throw new McpError(ErrorCode.InvalidRequest, `Invalid URI: ${request.params.uri}`);
            }
            const origin = decodeURIComponent(match[1]);
            const destination = decodeURIComponent(match[2]);
            try {
                const response = await this.axiosInstance.get('', {
                    params: {
                        origin: origin,
                        destination: destination,
                        key: API_KEY,
                    },
                });
                return {
                    contents: [
                        {
                            uri: request.params.uri,
                            mimeType: 'application/json',
                            text: JSON.stringify(response.data, null, 2),
                        },
                    ],
                };
            }
            catch (error) {
                if (axios.isAxiosError(error)) {
                    throw new McpError(ErrorCode.InternalError, `Google Maps API error: ${error.response?.data?.error_message || error.message}`);
                }
                throw error;
            }
        });
    }
    setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: 'get_directions',
                    description: 'Get directions using Google Maps Directions API',
                    inputSchema: {
                        type: 'object',
                        properties: {
                            origin: { type: 'string', description: '出発地' },
                            destination: { type: 'string', description: '目的地' },
                            mode: { type: 'string', description: '移動手段 (例: driving, walking, bicycling, transit)', default: 'driving' },
                        },
                        required: ['origin', 'destination'],
                    },
                },
            ],
        }));
        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            if (request.params.name !== 'get_directions') {
                throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
            }
            if (!isValidDirectionsArgs(request.params.arguments)) {
                throw new McpError(ErrorCode.InvalidParams, 'Invalid directions arguments');
            }
            const origin = request.params.arguments.origin;
            const destination = request.params.arguments.destination;
            const mode = request.params.arguments.mode || 'driving';
            try {
                const response = await this.axiosInstance.get('', {
                    params: {
                        origin: origin,
                        destination: destination,
                        mode: mode,
                        key: API_KEY,
                    },
                });
                return {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(response.data, null, 2),
                        },
                    ],
                };
            }
            catch (error) {
                if (axios.isAxiosError(error)) {
                    return {
                        content: [
                            {
                                type: 'text',
                                text: `Google Maps API error: ${error.response?.data?.error_message || error.message}`,
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
        console.error('Google Maps Directions MCP server running on stdio');
    }
}
if (process.argv[2] === 'test') {
    (async () => {
        try {
            const response = await axios.get('', {
                params: {
                    origin: 'Tokyo,JP',
                    destination: 'Osaka,JP',
                    mode: 'driving',
                    key: API_KEY,
                },
            });
            console.log(JSON.stringify(response.data, null, 2));
        }
        catch (error) {
            console.error(`Test query failed: ${error.message}`);
        }
        process.exit(0);
    })();
}
else {
    const server = new DirectionsServer();
    server.run().catch(console.error);
}
