# MCP Servers Collection

This repository contains a collection of Model Context Protocol (MCP) servers designed to interact with various external services. These servers allow language models like Claude to access real-time data and functionalities from these services.

## Servers Included

This repository currently includes the following MCP servers:

1. **`navitime-transit-server/`**

   * Provides transit route information using the Navitime API.
   * Allows querying for train schedules, fares, and transfer information.
   * See the [`navitime-transit-server/README.md`](./navitime-transit-server/README.md) for detailed setup and usage instructions.
2. **`googlemaps-directions-server/`**

   * Provides driving, walking, and cycling directions using the Google Maps Directions API.
   * Requires configuration with a valid Google Maps API key.
   * See the [`googlemaps-directions-server/README.md`](./googlemaps-directions-server/README.md) for detailed setup and usage instructions.
3. **`places-server/`**

   * Provides information about places, such as addresses, phone numbers, ratings, and reviews (likely using the Google Places API).
   * Requires configuration with a valid Google Places API key.
   * See the [`places-server/README.md`](./places-server/README.md) for detailed setup and usage instructions.

## General Development

Each server is a separate Node.js (TypeScript) project. To develop or build a specific server:

1. Navigate to the server's directory:
   ```bash
   cd <server-directory-name> # e.g., cd navitime-transit-server
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the server:
   ```bash
   npm run build
   ```
4. For development with auto-rebuild (if available):
   ```bash
   npm run watch
   ```

## Usage with Claude Desktop

To use these servers with Claude Desktop, you need to add their configurations to your `claude_desktop_config.json` file.

- **MacOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%/Claude/claude_desktop_config.json`

Add entries for each server you want to use within the `mcpServers` object. **Make sure to replace `/path/to/repo/...` with the actual absolute path to the built server files on your system.**

```json
{
  "mcpServers": {
    "navitime-mcp": {
      "command": "/path/to/repo/navitime-transit-server/build/index.js"
    },
    "gmaps-directions-mcp": {
      "command": "/path/to/repo/googlemaps-directions-server/dist/index.js" // Adjust path if needed
    },
    "places-mcp": {
      "command": "/path/to/repo/places-server/dist/index.js" // Adjust path if needed
    }
    // Add other servers here if needed
  }
}
```

**Note:** The exact command path might differ based on the build output configuration (`tsconfig.json`, `package.json`) of each server. Verify the correct path to the main JavaScript file (e.g., `index.js`) within the build output directory (commonly `build/` or `dist/`).

## Debugging

Since MCP servers communicate over stdio, debugging can be challenging. We recommend using the [MCP Inspector](https://github.com/modelcontextprotocol/inspector). You can typically run it from within each server's directory using:

```bash
npm run inspector # If the script is defined in package.json
```

The Inspector will provide a URL to access debugging tools in your browser.
