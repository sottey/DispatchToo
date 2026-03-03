#!/bin/bash

# Dispatch MCP Server Network Setup Script
# This script helps configure the MCP server for network access

set -e

echo "========================================="
echo "Dispatch MCP Server Network Setup"
echo "========================================="
echo ""

# Determine which env file to use
if [ -f ".env.prod" ]; then
    ENV_FILE=".env.prod"
    echo "Using existing .env.prod file"
elif [ -f ".env.local" ]; then
    ENV_FILE=".env.local"
    echo "Using existing .env.local file"
else
    echo "No .env file found. Creating .env.prod..."
    ENV_FILE=".env.prod"
    if [ -f ".env.prod.example" ]; then
        cp .env.prod.example .env.prod
        echo "Created .env.prod from template"
    else
        touch .env.prod
        echo "Created empty .env.prod"
    fi
fi

echo ""
echo "Current configuration:"
echo "  Environment file: $ENV_FILE"
echo ""

# Check if MCP_AUTH_TOKEN exists
if grep -q "^MCP_AUTH_TOKEN=" "$ENV_FILE" 2>/dev/null; then
    CURRENT_TOKEN=$(grep "^MCP_AUTH_TOKEN=" "$ENV_FILE" | cut -d'=' -f2)
    if [ -z "$CURRENT_TOKEN" ] || [ "$CURRENT_TOKEN" = "your-auth-token-here" ]; then
        echo "⚠️  MCP_AUTH_TOKEN is not set or is using default value"
        NEED_TOKEN=true
    else
        echo "✓ MCP_AUTH_TOKEN is already configured"
        NEED_TOKEN=false
    fi
else
    echo "⚠️  MCP_AUTH_TOKEN not found in $ENV_FILE"
    NEED_TOKEN=true
fi

if [ "$NEED_TOKEN" = true ]; then
    echo ""
    read -p "Generate a new MCP authentication token? (y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        NEW_TOKEN=$(openssl rand -hex 32)

        # Add or update MCP_AUTH_TOKEN
        if grep -q "^MCP_AUTH_TOKEN=" "$ENV_FILE" 2>/dev/null; then
            # Replace existing line (works on both macOS and Linux)
            if [[ "$OSTYPE" == "darwin"* ]]; then
                sed -i '' "s|^MCP_AUTH_TOKEN=.*|MCP_AUTH_TOKEN=$NEW_TOKEN|" "$ENV_FILE"
            else
                sed -i "s|^MCP_AUTH_TOKEN=.*|MCP_AUTH_TOKEN=$NEW_TOKEN|" "$ENV_FILE"
            fi
        else
            echo "MCP_AUTH_TOKEN=$NEW_TOKEN" >> "$ENV_FILE"
        fi

        echo "✓ Generated and saved new MCP_AUTH_TOKEN"
        echo ""
        echo "Your MCP authentication token:"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo "$NEW_TOKEN"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        echo ""
        echo "⚠️  Save this token securely! You'll need it to connect MCP clients."
    fi
fi

# Check MCP_PORT
if ! grep -q "^MCP_PORT=" "$ENV_FILE" 2>/dev/null; then
    echo "MCP_PORT=3001" >> "$ENV_FILE"
    echo "✓ Added MCP_PORT=3001"
fi

# Check MCP_ALLOWED_ORIGINS
if ! grep -q "^MCP_ALLOWED_ORIGINS=" "$ENV_FILE" 2>/dev/null; then
    echo "MCP_ALLOWED_ORIGINS=*" >> "$ENV_FILE"
    echo "✓ Added MCP_ALLOWED_ORIGINS=* (allows all origins)"
fi

echo ""
echo "========================================="
echo "Setup Complete!"
echo "========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Start or restart your Dispatch server:"
if [ "$ENV_FILE" = ".env.prod" ]; then
    echo "   docker-compose down && docker-compose up -d"
else
    echo "   npm run dev"
fi
echo ""
echo "2. Get your user ID:"
echo "   - Log into Dispatch web interface"
echo "   - Check browser dev tools or database"
echo ""
echo "3. Test the MCP server:"
echo "   curl http://localhost:3001/health"
echo ""
echo "4. Configure your MCP client:"
echo "   - Server URL: http://your-server-ip:3001/mcp"
echo "   - Auth Token: (see above)"
echo "   - User ID Header: x-dispatch-user-id"
echo ""
echo "For detailed instructions, see MCP-SERVER-SETUP.md"
echo ""
