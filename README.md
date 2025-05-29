# MCP Plugin Server

A centralized Model Context Protocol (MCP) server with plugin architecture for external tool integrations. This server allows you to manage multiple MCP tools as plugins rather than running separate servers for each integration.

## Features

- **Plugin Architecture**: Centralized management of MCP tools as plugins
- **Secure Credential Storage**: AES-256-GCM encrypted credential storage
- **RESTful API**: Complete REST API for plugin and credential management
- **WebSocket Support**: Real-time MCP protocol communication via WebSocket
- **Hot-Reloading**: Dynamic plugin loading and unloading
- **Authentication**: Multi-level authentication for server and plugin access
- **Example Plugins**: Pre-built examples including OpenWeatherMap integration

## Quick Start

### 1. Installation

```bash
# Clone the repository
git clone <repository-url>
cd mcp-plugin-server

# Install dependencies
npm install

# Build the project
npm run build
```

### 2. Configuration

Create a `.env` file with your configuration:

```bash
# Server port
PORT=3000

# Master key for encrypting credentials (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
MASTER_KEY=your_64_character_hex_master_key_here

# Admin token for accessing management endpoints
ADMIN_TOKEN=your_secure_admin_token_here

# Allowed origins for CORS (comma-separated)
ALLOWED_ORIGINS=http://localhost:3000

# Environment
NODE_ENV=development
```

### 3. Start the Server

```bash
# Development mode (with hot reloading)
npm run dev

# Production mode
npm start
```

The server will start on the configured port (default: 3000) and display:

- REST API endpoints: `http://localhost:3000/api/*`
- WebSocket MCP endpoint: `ws://localhost:3000/mcp`
- Health check: `http://localhost:3000/health`

## Docker Deployment

Run the MCP Plugin Server in Docker for consistent, isolated deployments across different environments.

### Quick Start with Docker

The easiest way to get started with Docker is using the provided setup script:

```bash
# Make the setup script executable (if not already)
chmod +x docker-setup.sh

# Quick setup and start (production mode)
./docker-setup.sh setup

# Or start in development mode with hot reload
./docker-setup.sh dev
```

### Manual Docker Setup

#### 1. Environment Configuration

Create a `.env` file from the example:

```bash
# Copy the example environment file
cp env.example .env

# Edit the file with your configuration
nano .env
```

Example `.env` configuration:

```bash
NODE_ENV=production
PORT=3000
MASTER_KEY=your-secure-64-character-hex-master-key-here
ADMIN_TOKEN=your-secure-admin-token-here
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

#### 2. Production Deployment

```bash
# Build and start the production container
docker-compose up --build -d

# View logs
docker-compose logs -f

# Stop the container
docker-compose down
```

#### 3. Development Mode

For development with hot reload and debugging:

```bash
# Start in development mode
docker-compose -f docker-compose.dev.yml up --build -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop development containers
docker-compose -f docker-compose.dev.yml down
```

### Docker Setup Script Commands

The `docker-setup.sh` script provides convenient commands for managing your Docker deployment:

```bash
# Setup and start (production mode)
./docker-setup.sh setup

# Start in development mode
./docker-setup.sh dev

# View logs (production)
./docker-setup.sh logs

# View development logs
./docker-setup.sh logs dev

# Stop containers
./docker-setup.sh stop

# Restart containers
./docker-setup.sh restart

# Check container status
./docker-setup.sh status

# Clean up Docker resources
./docker-setup.sh clean

# Show help
./docker-setup.sh help
```

### Docker Features

- **Multi-stage Build**: Optimized production images with minimal size
- **Security**: Non-root user execution for enhanced security
- **Health Checks**: Built-in health monitoring for container orchestration
- **Persistent Storage**: Volume mounts for data, plugins, and configuration
- **Development Support**: Hot reload and debugging capabilities
- **Environment Variables**: Flexible configuration via environment variables

### Volume Mounts

The Docker setup includes the following volume mounts:

```yaml
volumes:
  - ./data:/app/data # Persistent credential storage
  - ./plugins:/app/plugins # Plugin files
  - ./config:/app/config # Configuration files
```

### Environment Variables

Key environment variables for Docker deployment:

| Variable          | Description                    | Default                                       |
| ----------------- | ------------------------------ | --------------------------------------------- |
| `NODE_ENV`        | Environment mode               | `production`                                  |
| `PORT`            | Server port                    | `3000`                                        |
| `MASTER_KEY`      | Encryption key for credentials | Auto-generated                                |
| `ADMIN_TOKEN`     | Admin API access token         | Auto-generated                                |
| `ALLOWED_ORIGINS` | CORS allowed origins           | `http://localhost:3000,http://localhost:3001` |

### Production Considerations

For production deployments:

1. **Security**: Always set custom `MASTER_KEY` and `ADMIN_TOKEN`
2. **Backup**: Regularly backup the `./data` directory
3. **Monitoring**: Use the health check endpoint for monitoring
4. **Updates**: Use `docker-compose pull` to update images
5. **Logs**: Configure log rotation and centralized logging

### Kubernetes Deployment

For Kubernetes deployments, you can use the Docker image with these considerations:

```yaml
# Example Kubernetes deployment snippet
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-plugin-server
spec:
  replicas: 1
  selector:
    matchLabels:
      app: mcp-plugin-server
  template:
    spec:
      containers:
        - name: mcp-plugin-server
          image: mcp-plugin-server:latest
          ports:
            - containerPort: 3000
          env:
            - name: MASTER_KEY
              valueFrom:
                secretKeyRef:
                  name: mcp-secrets
                  key: master-key
            - name: ADMIN_TOKEN
              valueFrom:
                secretKeyRef:
                  name: mcp-secrets
                  key: admin-token
          volumeMounts:
            - name: data-storage
              mountPath: /app/data
            - name: plugin-storage
              mountPath: /app/plugins
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
```

## API Documentation

### Authentication

All admin endpoints require an `Authorization` header:

```
Authorization: Bearer your_admin_token_here
```

### Plugin Management

#### List Plugins

```bash
GET /api/plugins
Authorization: Bearer <admin_token>
```

#### Enable Plugin

```bash
POST /api/plugins/:id/enable
Authorization: Bearer <admin_token>
```

#### Disable Plugin

```bash
POST /api/plugins/:id/disable
Authorization: Bearer <admin_token>
```

#### Update Plugin Configuration

```bash
PUT /api/plugins/:id/config
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "enabled": true,
  "config": {
    "key": "value"
  }
}
```

#### Remove Plugin

```bash
DELETE /api/plugins/:id
Authorization: Bearer <admin_token>
```

### Credential Management

#### Store Credential

```bash
POST /api/auth/credentials
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "pluginId": "openweather",
  "credentialId": "api_key",
  "value": "your_api_key_here"
}
```

#### List Plugin Credentials

```bash
GET /api/auth/credentials/:pluginId
Authorization: Bearer <admin_token>
```

#### Delete Credential

```bash
DELETE /api/auth/credentials/:pluginId/:credentialId
Authorization: Bearer <admin_token>
```

### MCP Protocol

#### List Available Tools

```bash
GET /api/mcp/tools
```

#### List Available Resources

```bash
GET /api/mcp/resources
```

#### Execute Tool

```bash
POST /api/mcp/tools/execute
Content-Type: application/json

{
  "toolName": "openweather.get_weather",
  "args": {
    "location": "London,UK",
    "units": "metric"
  }
}
```

### WebSocket MCP Communication

Connect to `ws://localhost:3000/mcp` and send JSON-RPC 2.0 messages:

```javascript
// List tools
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}

// Call a tool
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "openweather.get_weather",
    "arguments": {
      "location": "London,UK"
    }
  }
}
```

## Plugin Development

### Creating a Plugin

1. Create a plugin directory in the `plugins/` folder
2. Implement the `MCPPlugin` interface:

```typescript
import { MCPPlugin, PluginContext, Tool, Resource } from "../types/plugin";

export class MyPlugin implements MCPPlugin {
  public readonly name = "my-plugin";
  public readonly version = "1.0.0";
  public readonly description = "My custom plugin";
  public readonly dependencies: string[] = [];

  private context: PluginContext | null = null;

  async initialize(context: PluginContext): Promise<void> {
    this.context = context;
    // Initialize your plugin here
  }

  getTools(): Tool[] {
    return [
      {
        name: "my_tool",
        description: "Description of my tool",
        inputSchema: {
          type: "object",
          properties: {
            param: { type: "string", description: "Parameter description" },
          },
          required: ["param"],
        },
      },
    ];
  }

  getResources(): Resource[] {
    return [];
  }

  async executeTool(name: string, args: any): Promise<any> {
    switch (name) {
      case "my_tool":
        return { result: `Hello, ${args.param}!` };
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  }

  async cleanup(): Promise<void> {
    this.context = null;
  }
}
```

3. Create a `plugin.json` manifest:

```json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My custom plugin",
  "author": "Your Name",
  "auth": {
    "type": "api-key",
    "required": true,
    "fields": {
      "api_key": {
        "type": "password",
        "required": true,
        "description": "API key for the service"
      }
    }
  }
}
```

4. Build and load your plugin via the API

### Plugin Context

The `PluginContext` provides access to:

- **Credentials**: Secure storage for API keys and tokens
- **Logger**: Plugin-specific logging
- **Configuration**: Plugin configuration from the registry
- **OAuth**: OAuth 2.0 flow support (future feature)

```typescript
// Store a credential
await context.setCredential("api_key", "your_key_here");

// Retrieve a credential
const apiKey = await context.getCredential("api_key");

// Log messages
context.logger.info("Plugin initialized");
context.logger.error("Something went wrong");
```

## Example: Weather Plugin

The included OpenWeatherMap plugin demonstrates:

1. API key authentication
2. Multiple tools (current weather and forecast)
3. Error handling
4. Structured data return

### Setup

1. Get an API key from [OpenWeatherMap](https://openweathermap.org/api)
2. Store the credential:

```bash
curl -X POST http://localhost:3000/api/auth/credentials \
  -H "Authorization: Bearer your_admin_token" \
  -H "Content-Type: application/json" \
  -d '{
    "pluginId": "openweather",
    "credentialId": "api_key",
    "value": "your_openweather_api_key"
  }'
```

3. Load and enable the plugin:

```bash
# This would be implemented in the plugin loading mechanism
curl -X POST http://localhost:3000/api/plugins/openweather/enable \
  -H "Authorization: Bearer your_admin_token"
```

4. Use the weather tools:

```bash
curl -X POST http://localhost:3000/api/mcp/tools/execute \
  -H "Content-Type: application/json" \
  -d '{
    "toolName": "openweather.get_weather",
    "args": {
      "location": "London,UK",
      "units": "metric"
    }
  }'
```

## Security

- **Credential Encryption**: All credentials are encrypted using AES-256-GCM
- **Plugin Isolation**: Each plugin has isolated credential storage
- **Authentication**: Admin endpoints require token authentication
- **Input Validation**: Request validation and sanitization
- **Rate Limiting**: Protection against abuse
- **CORS**: Configurable cross-origin policies

## Development Scripts

```bash
# Start development server with hot reloading
npm run dev

# Build the project
npm run build

# Start production server
npm start

# Run tests
npm test

# Run linting
npm run lint
```

## Architecture

```
mcp-plugin-server/
├── src/
│   ├── core/
│   │   ├── registry.ts          # Plugin discovery and loading
│   │   ├── plugin-manager.ts    # Plugin lifecycle management
│   │   └── auth/
│   │       └── secure-storage.ts    # Encrypted credential storage
│   ├── plugins/
│   │   └── examples/           # Example plugins
│   ├── types/                  # TypeScript interfaces
│   └── server.ts               # Express server and MCP protocol
├── plugins/                    # External plugin directory
├── config/
│   └── plugins.json           # Plugin configuration
└── data/
    └── credentials/           # Encrypted credential storage
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Roadmap

- [ ] OAuth 2.0 implementation
- [ ] Plugin marketplace/discovery
- [ ] Advanced sandboxing
- [ ] Cloud secrets integration
- [ ] Admin web interface
- [ ] Plugin hot-reloading
- [ ] Clustering support
