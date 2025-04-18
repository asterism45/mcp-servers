declare module '@modelcontextprotocol/sdk/server/index.js' {
  export class Server {
    constructor(config: { name: string; version: string }, options?: any);
    connect(transport: any): Promise<void>;
    close(): Promise<void>;
    setRequestHandler(schema: any, handler: any): void;
    onerror: (error: any) => void;
  }
}

declare module '@modelcontextprotocol/sdk/server/stdio.js' {
  export class StdioServerTransport {}
}

declare module '@modelcontextprotocol/sdk/types.js' {
  export const CallToolRequestSchema: any;
  export const ErrorCode: any;
  export const ListToolsRequestSchema: any;
  export const ListResourcesRequestSchema: any;
  export const ListResourceTemplatesRequestSchema: any;
  export const ReadResourceRequestSchema: any;
  export class McpError extends Error {
    constructor();
    constructor(code: any);
    constructor(code: any, message?: string);
  }
}