#!/bin/bash

# Show MCP Server Configuration
# Displays current MCP configuration from environment files

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo "========================================="
echo "Dispatch MCP Server Configuration"
echo "========================================="
echo ""

# Function to extract value from env file
get_env_value() {
    local file=$1
    local key=$2
    grep "^${key}=" "$file" 2>/dev/null | cut -d'=' -f2-
}

# Check which env file exists
ENV_FILE=""
if [ -f ".env.prod" ]; then
    ENV_FILE=".env.prod"
elif [ -f ".env.local" ]; then
    ENV_FILE=".env.local"
else
    echo "No .env.prod or .env.local file found!"
    echo ""
    echo "Run ./scripts/setup-mcp-network.sh to configure MCP server."
    exit 1
fi

echo -e "${CYAN}Environment file:${NC} $ENV_FILE"
echo ""

# Get MCP configuration
MCP_PORT=$(get_env_value "$ENV_FILE" "MCP_PORT")
MCP_AUTH_TOKEN=$(get_env_value "$ENV_FILE" "MCP_AUTH_TOKEN")
MCP_ALLOWED_ORIGINS=$(get_env_value "$ENV_FILE" "MCP_ALLOWED_ORIGINS")

# Display configuration
echo -e "${CYAN}MCP Port:${NC}"
if [ -n "$MCP_PORT" ]; then
    echo "  $MCP_PORT"
else
    echo -e "  ${YELLOW}Not set (default: 3001)${NC}"
fi

echo ""
echo -e "${CYAN}MCP Authentication Token:${NC}"
if [ -n "$MCP_AUTH_TOKEN" ]; then
    echo "  $MCP_AUTH_TOKEN"
    echo ""
    echo -e "  ${GREEN}⚠️  Keep this token secure!${NC}"
else
    echo -e "  ${YELLOW}⚠️  NOT SET - Server is not secured!${NC}"
    echo "  Run ./scripts/setup-mcp-network.sh to generate a token"
fi

echo ""
echo -e "${CYAN}Allowed CORS Origins:${NC}"
if [ -n "$MCP_ALLOWED_ORIGINS" ]; then
    echo "  $MCP_ALLOWED_ORIGINS"
else
    echo -e "  ${YELLOW}Not set (default: localhost:8082)${NC}"
fi

echo ""
echo "========================================="
echo "Server Endpoint"
echo "========================================="
echo ""
echo "URL: http://YOUR_SERVER_IP:${MCP_PORT:-3001}/mcp"
echo ""
echo "Test health:"
echo "  curl http://localhost:${MCP_PORT:-3001}/health"
echo ""

if [ -n "$MCP_AUTH_TOKEN" ]; then
    echo "========================================="
    echo "Copy-Paste Configuration"
    echo "========================================="
    echo ""
    echo "For Claude Desktop (replace YOUR_SERVER_IP and YOUR_USER_ID):"
    echo ""
    echo '{'
    echo '  "mcpServers": {'
    echo '    "dispatch": {'
    echo '      "command": "node",'
    echo '      "args": ["'$(pwd)'/scripts/mcp-bridge.js"],'
    echo '      "env": {'
    echo '        "MCP_SERVER_URL": "http://YOUR_SERVER_IP:'${MCP_PORT:-3001}'/mcp",'
    echo '        "MCP_AUTH_TOKEN": "'$MCP_AUTH_TOKEN'",'
    echo '        "DISPATCH_USER_ID": "YOUR_USER_ID"'
    echo '      }'
    echo '    }'
    echo '  }'
    echo '}'
    echo ""
fi
