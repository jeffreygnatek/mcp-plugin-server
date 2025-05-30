#!/bin/bash

# MCP Plugin Server Demo Startup Script

echo "\U0001F680 Starting MCP Plugin Server Demo..."

# Set environment variables
export PORT=3117
export ADMIN_TOKEN=demo-admin-token
export MASTER_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
export NODE_ENV=development

echo "📋 Configuration:"
echo "   Port: $PORT"
echo "   Admin Token: $ADMIN_TOKEN"
echo "   Master Key: $MASTER_KEY"
echo "   Environment: $NODE_ENV"
echo ""

# Check if build exists
if [ ! -d "dist" ]; then
    echo "🔨 Building project..."
    npm run build
    echo ""
fi

echo "🌟 Starting server..."
echo "   Health check: http://localhost:$PORT/health"
echo "   Admin API: http://localhost:$PORT/api/"
echo "   WebSocket: ws://localhost:$PORT/mcp"
echo ""
echo "📖 To test the server, run: node demo.js (in another terminal)"
echo "🛑 To stop the server, press Ctrl+C"
echo ""

# Start the server
npm start 