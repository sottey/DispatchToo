# Dispatch MCP Server - Network Setup Guide

This guide explains how to set up the Dispatch MCP server for network access and connect it to Claude Desktop or other MCP clients.

## Overview

The Dispatch MCP server provides AI assistants with tools to manage:
- **Tasks**: Create, update, complete, and list tasks
- **Projects**: Manage project information
- **Notes**: Create and manage markdown notes
- **Dispatches**: Daily planning and dispatch management
- **Search**: Global search across all content

## Server Configuration

### 1. Environment Variables

Add these variables to your `.env.prod` file (for Docker) or `.env.local` (for local development):

```bash
# MCP Server Port (default: 3001)
MCP_PORT=3001

# Authentication Token (REQUIRED for network access)
# Generate a secure random token: openssl rand -hex 32
MCP_AUTH_TOKEN=your-secure-random-token-here

# Allowed CORS Origins
# Use "*" for development or specify allowed origins separated by commas
MCP_ALLOWED_ORIGINS=*
# Or specific origins:
# MCP_ALLOWED_ORIGINS=http://localhost:8082,https://your-domain.com
```

### 2. Docker Deployment

The MCP server is automatically started with the main application. The docker-compose.yml has been updated to expose port 3001.

**Update your .env.prod file:**

```bash
# Add these to your existing .env.prod
MCP_PORT=3001
MCP_AUTH_TOKEN=$(openssl rand -hex 32)  # Generate a secure token
MCP_ALLOWED_ORIGINS=*
```

**Restart the Docker container:**

```bash
docker-compose down
docker-compose up -d
```

### 3. Local Development

When running with `npm run dev`, the MCP server starts automatically on port 3001.

**Update .env.local:**

```bash
# Add to .env.local
MCP_PORT=3001
MCP_AUTH_TOKEN=your-dev-token-here
MCP_ALLOWED_ORIGINS=*
```

**Restart the development server:**

```bash
npm run dev
```

## Connecting to Claude Desktop

### Important Note

Claude Desktop's native MCP integration uses **stdio** (standard input/output) for local processes, not HTTP. The Dispatch MCP server uses HTTP transport, which is designed for:

1. **Web-based integrations** (like the Personal Assistant feature in the Dispatch app)
2. **Custom MCP clients** that support HTTP transport
3. **Remote access** over a network

### Connection Options

#### Option 1: Use the Built-in Personal Assistant (Recommended)

The Dispatch application already includes a Personal Assistant feature that connects to the MCP server automatically. This is the easiest way to use the MCP tools.

Access it at: `http://your-server:8082/assistant`

#### Option 2: Create an HTTP-to-Stdio Bridge

To connect the HTTP MCP server to Claude Desktop, you'll need a bridge script. Here's an example:

**Create `mcp-bridge.js`:**

```javascript
#!/usr/bin/env node

const http = require('http');
const readline = require('readline');

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3001/mcp';
const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;
const USER_ID = process.env.DISPATCH_USER_ID || 'default-user';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', async (line) => {
  try {
    const request = JSON.parse(line);

    const response = await fetch(MCP_SERVER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MCP_AUTH_TOKEN}`,
        'x-dispatch-user-id': USER_ID
      },
      body: JSON.stringify(request)
    });

    const data = await response.json();
    console.log(JSON.stringify(data));
  } catch (error) {
    console.error(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32603, message: error.message },
      id: null
    }));
  }
});
```

**Make it executable:**

```bash
chmod +x mcp-bridge.js
```

**Add to Claude Desktop config** (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "dispatch": {
      "command": "node",
      "args": ["/path/to/mcp-bridge.js"],
      "env": {
        "MCP_SERVER_URL": "http://your-server-ip:3001/mcp",
        "MCP_AUTH_TOKEN": "your-auth-token-here",
        "DISPATCH_USER_ID": "your-user-id"
      }
    }
  }
}
```

#### Option 3: Direct HTTP Integration

For custom applications, you can connect directly to the HTTP endpoint:

**Endpoint:** `http://your-server:3001/mcp`

**Headers:**
- `Content-Type: application/json`
- `Authorization: Bearer your-auth-token`
- `x-dispatch-user-id: your-user-id` (required for authentication)

**Example request:**

```bash
curl -X POST http://your-server:3001/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-auth-token" \
  -H "x-dispatch-user-id: user123" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "id": 1
  }'
```

## Available Tools

Once connected, the following MCP tools are available:

### Tasks
- `list-tasks` - List tasks with optional filters (status, priority, project)
- `create-task` - Create a new task
- `update-task` - Update an existing task
- `complete-task` - Mark a task as done
- `delete-task` - Soft-delete a task

### Projects
- `list-projects` - List all projects
- `create-project` - Create a new project
- `update-project` - Update project details
- `delete-project` - Soft-delete a project

### Notes
- `list-notes` - List notes with search and filters
- `create-note` - Create a new note
- `update-note` - Update a note
- `delete-note` - Soft-delete a note

### Dispatches
- `list-dispatches` - List daily dispatches
- `create-dispatch` - Create a dispatch for a date
- `update-dispatch` - Update dispatch details
- `complete-dispatch` - Mark dispatch as complete

### Search
- `search-all` - Global search across tasks, notes, and dispatches

## Security Considerations

When exposing the MCP server on your network:

1. **Always set MCP_AUTH_TOKEN** - Never run without authentication on a network
2. **Use HTTPS** - Consider putting the server behind a reverse proxy with SSL
3. **Firewall rules** - Restrict access to trusted IPs if possible
4. **User ID verification** - The `x-dispatch-user-id` header determines which user's data is accessed

## Troubleshooting

### Health Check

Test if the server is running:

```bash
curl http://your-server:3001/health
```

Expected response:
```json
{"ok": true, "port": 3001}
```

### CORS Issues

If you get CORS errors, verify:
1. `MCP_ALLOWED_ORIGINS` is set correctly
2. The Origin header matches an allowed origin
3. Restart the server after changing environment variables

### Authentication Errors

If you get 401 Unauthorized:
1. Verify `MCP_AUTH_TOKEN` matches in server and client
2. Ensure `Authorization: Bearer <token>` header is sent
3. Check that `x-dispatch-user-id` header is included

## Getting Your User ID

To find your user ID for the `x-dispatch-user-id` header:

1. Log into the Dispatch web interface
2. Open browser developer tools (F12)
3. Check the Application/Storage tab for session data, or
4. Check API requests in the Network tab - they include the user ID

Alternatively, query the database directly:

```bash
# If using Docker
docker exec -it dispatch-dispatch-1 sqlite3 /app/data/dispatch.db "SELECT id, email FROM users;"

# If running locally
sqlite3 dispatch.db "SELECT id, email FROM users;"
```

## Further Help

- Main Dispatch README: [README.md](./README.md)
- MCP SDK Documentation: https://github.com/modelcontextprotocol/sdk
- Report issues: https://github.com/nkasco/DispatchTodoApp/issues
