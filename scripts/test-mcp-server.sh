#!/bin/bash

# Test MCP Server Connection
# This script helps verify that your MCP server is accessible and working

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
MCP_HOST=${MCP_HOST:-localhost}
MCP_PORT=${MCP_PORT:-3001}
MCP_AUTH_TOKEN=${MCP_AUTH_TOKEN:-}
DISPATCH_USER_ID=${DISPATCH_USER_ID:-test-user}

echo "========================================="
echo "Dispatch MCP Server Connection Test"
echo "========================================="
echo ""
echo "Configuration:"
echo "  Host: $MCP_HOST"
echo "  Port: $MCP_PORT"
echo "  User ID: $DISPATCH_USER_ID"
if [ -n "$MCP_AUTH_TOKEN" ]; then
    echo "  Auth Token: ${MCP_AUTH_TOKEN:0:8}...${MCP_AUTH_TOKEN: -8}"
else
    echo "  Auth Token: (not set)"
fi
echo ""

# Test 1: Health check
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 1: Health Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Checking http://$MCP_HOST:$MCP_PORT/health ..."

if curl -s -f "http://$MCP_HOST:$MCP_PORT/health" > /dev/null 2>&1; then
    HEALTH=$(curl -s "http://$MCP_HOST:$MCP_PORT/health")
    echo -e "${GREEN}✓ Server is running${NC}"
    echo "  Response: $HEALTH"
else
    echo -e "${RED}✗ Server is not responding${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  - Is the server running? (docker-compose ps or npm run dev)"
    echo "  - Is port $MCP_PORT accessible?"
    echo "  - Check firewall settings"
    exit 1
fi

echo ""

# Test 2: List tools (without auth)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Test 2: List Tools (No Auth)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "http://$MCP_HOST:$MCP_PORT/mcp" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "x-dispatch-user-id: $DISPATCH_USER_ID" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}✓ Authentication is required (expected)${NC}"
    echo "  Server properly enforces authentication"
elif [ "$HTTP_CODE" = "200" ]; then
    echo -e "${YELLOW}⚠ Authentication is NOT required${NC}"
    echo "  WARNING: Server is accessible without authentication!"
    echo "  Set MCP_AUTH_TOKEN environment variable for security"
    echo ""
    echo "  Available tools: $(echo "$BODY" | grep -o '"name"' | wc -l)"
else
    echo -e "${RED}✗ Unexpected response${NC}"
    echo "  HTTP Code: $HTTP_CODE"
    echo "  Response: $BODY"
fi

echo ""

# Test 3: List tools (with auth)
if [ -n "$MCP_AUTH_TOKEN" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Test 3: List Tools (With Auth)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "http://$MCP_HOST:$MCP_PORT/mcp" \
      -H "Content-Type: application/json" \
      -H "Accept: application/json, text/event-stream" \
      -H "Authorization: Bearer $MCP_AUTH_TOKEN" \
      -H "x-dispatch-user-id: $DISPATCH_USER_ID" \
      -d '{"jsonrpc":"2.0","method":"tools/list","id":1}')

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓ Successfully authenticated${NC}"
        echo ""
        echo "Available MCP tools:"
        echo "$BODY" | grep -o '"name":"[^"]*"' | sed 's/"name":"//;s/"$//' | while read -r tool; do
            echo "  • $tool"
        done
    else
        echo -e "${RED}✗ Authentication failed${NC}"
        echo "  HTTP Code: $HTTP_CODE"
        echo "  Response: $BODY"
        echo ""
        echo "Troubleshooting:"
        echo "  - Verify MCP_AUTH_TOKEN matches the server configuration"
        echo "  - Check that Authorization header is correctly formatted"
    fi

    echo ""
else
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Test 3: Skipped (no auth token provided)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "To test with authentication, set environment variable:"
    echo "  MCP_AUTH_TOKEN=your-token-here $0"
    echo ""
fi

echo "========================================="
echo "Test Summary"
echo "========================================="
echo ""
echo "Server URL: http://$MCP_HOST:$MCP_PORT/mcp"
echo ""
echo "To use with Claude Desktop, configure the bridge:"
echo ""
echo "  1. Edit scripts/mcp-bridge.js configuration or set env vars"
echo "  2. Add to Claude Desktop config:"
echo ""
echo '  {
    "mcpServers": {
      "dispatch": {
        "command": "node",
        "args": ["'$(pwd)'/scripts/mcp-bridge.js"],
        "env": {
          "MCP_SERVER_URL": "http://'$MCP_HOST':'$MCP_PORT'/mcp",
          "MCP_AUTH_TOKEN": "your-token-here",
          "DISPATCH_USER_ID": "'$DISPATCH_USER_ID'"
        }
      }
    }
  }'
echo ""
echo "For more details, see MCP-SERVER-SETUP.md"
echo ""
