# Genkit & MCP Setup Guide

This guide will help you install Genkit and configure the Model Context Protocol (MCP).

## 1. Prerequisites
Ensure you have **Node.js 20+** installed.
Check your version:
```bash
node --version
```

## 2. Install Genkit CLI
Install the Genkit CLI globally:
```bash
npm install -g genkit
```

## 3. Initialize a Genkit Project
Create a directory for your project (or use an existing one) and initialize Genkit:
```bash
mkdir my-genkit-project
cd my-genkit-project
genkit init
```
Select **Node.js** as the platform.

## 4. Install MCP Plugin
To use MCP (Model Context Protocol) with Genkit, install the plugin:
```bash
npm install @genkit-ai/mcp
```

## 5. Configure MCP
In your `genkit.config.ts` (or `.js`), configure the plugin.

**To consume MCP servers:**
```typescript
import { mcpClient } from '@genkit-ai/mcp';

export default configureGenkit({
  plugins: [
    mcpClient({
      servers: {
        // Example: Connect to a local MCP server
        "myserver": {
            command: "npx",
            args: ["-y", "@modelcontextprotocol/server-filesystem", "./files"]
        }
      }
    }),
    // ... other plugins
  ]
});
```

**To expose Genkit as an MCP server:**
```typescript
import { mcpServer } from '@genkit-ai/mcp';

export default configureGenkit({
  plugins: [
    mcpServer({
      name: "my-genkit-server",
      version: "1.0.0"
    }),
    // ...
  ]
});
```
Then run your Genkit flow!
