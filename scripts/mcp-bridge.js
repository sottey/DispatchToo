#!/usr/bin/env node

/**
 * Dispatch MCP HTTP-to-Stdio Bridge
 *
 * This bridge allows Claude Desktop (which uses stdio for MCP) to connect
 * to the Dispatch HTTP MCP server running on your network.
 *
 * Usage:
 *   node mcp-bridge.js
 *
 * Environment Variables:
 *   MCP_SERVER_URL      - HTTP URL of the MCP server (default: http://localhost:3001/mcp)
 *   MCP_AUTH_TOKEN      - Authentication token for the MCP server
 *   DISPATCH_USER_ID    - Your Dispatch user ID
 *   DEBUG               - Set to '1' to enable debug logging to stderr
 */

const http = require('http');
const https = require('https');
const readline = require('readline');

// Configuration
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:3001/mcp';
const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;
const USER_ID = process.env.DISPATCH_USER_ID;
const DEBUG = process.env.DEBUG === '1';

// Validate configuration
if (!MCP_AUTH_TOKEN) {
  console.error('Error: MCP_AUTH_TOKEN environment variable is required');
  process.exit(1);
}

if (!USER_ID) {
  console.error('Error: DISPATCH_USER_ID environment variable is required');
  process.exit(1);
}

function debug(...args) {
  if (DEBUG) {
    console.error('[MCP Bridge]', ...args);
  }
}

debug('Starting MCP bridge...');
debug('Server URL:', MCP_SERVER_URL);
debug('User ID:', USER_ID);

// Parse URL to determine http vs https
const url = new URL(MCP_SERVER_URL);
const requester = url.protocol === 'https:' ? https : http;

// Session management
let sessionId = null;

async function makeRequest(jsonrpcRequest) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(jsonrpcRequest);

    const options = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'Authorization': `Bearer ${MCP_AUTH_TOKEN}`,
        'x-dispatch-user-id': USER_ID,
      }
    };

    // Add session ID if we have one
    if (sessionId) {
      options.headers['mcp-session-id'] = sessionId;
    }

    debug('Request:', JSON.stringify(jsonrpcRequest, null, 2));

    const req = requester.request(MCP_SERVER_URL, options, (res) => {
      // Capture session ID from response
      const newSessionId = res.headers['mcp-session-id'];
      if (newSessionId) {
        sessionId = newSessionId;
        debug('Session ID:', sessionId);
      }

      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          debug('Response:', JSON.stringify(response, null, 2));
          resolve(response);
        } catch (error) {
          debug('Parse error:', error);
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      debug('Request error:', error);
      reject(error);
    });

    req.write(postData);
    req.end();
  });
}

// Set up stdio interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', async (line) => {
  try {
    const request = JSON.parse(line);
    const response = await makeRequest(request);
    console.log(JSON.stringify(response));
  } catch (error) {
    debug('Error processing request:', error);
    console.log(JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code: -32603,
        message: error.message || 'Internal error'
      },
      id: null
    }));
  }
});

rl.on('close', () => {
  debug('Bridge closed');
  process.exit(0);
});

// Handle process termination
process.on('SIGINT', () => {
  debug('Received SIGINT, closing...');
  rl.close();
});

process.on('SIGTERM', () => {
  debug('Received SIGTERM, closing...');
  rl.close();
});

debug('Bridge ready, waiting for requests...');
