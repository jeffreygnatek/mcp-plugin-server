# MCP Plugin Server Development Instructions

Build an open source MCP (Model Context Protocol) server using Express and TypeScript that supports a plugin architecture instead of individual servers per external tool.

## Project Overview

Create a centralized MCP server where external tools/resources are registered as plugins rather than separate servers. This reduces complexity and enables better management of multiple integrations.

## Core Architecture Requirements

### 1. Plugin Registry System

- Central registry for plugin discovery, loading, and management
- Plugin lifecycle management (initialize, start, stop, cleanup)
- Dependency resolution between plugins
- Hot-reloading capabilities for development

### 2. Plugin Interface

Implement a standardized interface that all plugins must implement:

```typescript
interface MCPPlugin {
  name: string;
  version: string;
  description: string;
  dependencies?: string[];

  initialize(context: PluginContext): Promise<void>;
  getTools(): Tool[];
  getResources(): Resource[];
  executeTool(name: string, args: any): Promise<any>;
  cleanup(): Promise<void>;
}

interface PluginContext {
  pluginId: string;
  config: any;
  logger: Logger;

  // Authentication methods
  getCredential(key: string): Promise<string | null>;
  setCredential(key: string, value: string): Promise<void>;

  // OAuth-specific methods
  getAccessToken(): Promise<string>;
  isAuthenticated(): Promise<boolean>;
  getTokenInfo(): Promise<OAuthToken | null>;
  requireReauth(): Promise<string>;
}
```

### 3. Project Structure

```
mcp-plugin-server/
├── src/
│   ├── core/
│   │   ├── registry.ts          # Plugin registry and loader
│   │   ├── plugin-manager.ts    # Plugin lifecycle management
│   │   ├── mcp-handler.ts       # MCP protocol implementation
│   │   ├── auth/
│   │   │   ├── secure-storage.ts    # Encrypted credential storage
│   │   │   ├── oauth-manager.ts     # OAuth flow management
│   │   │   └── token-manager.ts     # Token refresh and validation
│   ├── plugins/
│   │   ├── base/               # Base plugin classes
│   │   └── examples/           # Example plugins
│   ├── api/
│   │   ├── routes/             # Express routes (including OAuth callbacks)
│   │   └── middleware/         # Auth, validation, etc.
│   ├── types/
│   │   ├── plugin.ts           # Plugin interfaces
│   │   ├── auth.ts             # Authentication types
│   │   └── oauth.ts            # OAuth-specific types
│   └── server.ts               # Main Express server
├── plugins/                    # External plugin directory
└── config/
    └── plugins.json           # Plugin configuration
```

## Authentication System Requirements

### 1. Multi-Level Authentication

- **Server-Level**: MCP client authentication, admin API authentication
- **Plugin-Level**: Per-plugin API key storage, OAuth support, credential isolation

### 2. Secure Credential Storage

Implement encrypted storage with these interfaces:

```typescript
interface SecureStorage {
  storeCredential(
    pluginId: string,
    credentialId: string,
    value: string
  ): Promise<void>;
  retrieveCredential(pluginId: string, credentialId: string): Promise<string>;
  deleteCredential(pluginId: string, credentialId: string): Promise<void>;
  listCredentials(pluginId: string): Promise<string[]>;
}
```

**Storage Implementation:**

- Use AES-256-GCM encryption with unique initialization vectors
- Master key from environment variable
- Plugin-isolated credential namespaces
- Support for multiple storage backends (file, database, cloud secrets)

### 3. OAuth 2.0 Support

Implement comprehensive OAuth support:

```typescript
interface OAuthConfig {
  provider: string;
  clientId: string;
  clientSecret: string;
  scopes: string[];
  authorizationUrl: string;
  tokenUrl: string;
  redirectUri: string;
  pkce?: boolean;
}

interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope: string;
  tokenType: "Bearer" | string;
}

interface OAuthManager {
  initiateFlow(
    pluginId: string,
    config: OAuthConfig
  ): Promise<{
    authUrl: string;
    state: string;
  }>;
  handleCallback(code: string, state: string): Promise<OAuthToken>;
  refreshToken(pluginId: string, refreshToken: string): Promise<OAuthToken>;
  revokeToken(pluginId: string): Promise<void>;
}
```

**OAuth Features Required:**

- PKCE support for enhanced security
- State parameter for CSRF protection
- Automatic token refresh
- Support for common providers (Google, Microsoft, GitHub)
- Custom provider configuration
- Token revocation and re-authentication

### 4. Plugin Authentication Configuration

Support multiple authentication types:

```typescript
interface PluginAuthConfig {
  type: "api-key" | "oauth2" | "jwt" | "custom";
  required: boolean;
  fields: {
    [key: string]: {
      type: "string" | "password" | "url";
      required: boolean;
      description: string;
      validation?: RegExp;
    };
  };
}
```

## Express Server Requirements

### 1. Core Endpoints

- **MCP Protocol**: WebSocket or Server-Sent Events for real-time communication
- **Plugin Management**: RESTful API for plugin CRUD operations
- **OAuth Callbacks**: Handle OAuth authorization callbacks
- **Admin Interface**: Web UI for plugin and credential management

### 2. Required Routes

```typescript
// Plugin management
GET    /api/plugins                 # List all plugins
POST   /api/plugins/:id/enable      # Enable plugin
POST   /api/plugins/:id/disable     # Disable plugin
PUT    /api/plugins/:id/config      # Update plugin config
DELETE /api/plugins/:id             # Remove plugin

// Authentication
POST   /api/auth/credentials        # Store credentials
GET    /api/auth/oauth/initiate/:pluginId  # Start OAuth flow
GET    /oauth/callback/:pluginId    # OAuth callback handler
POST   /api/auth/oauth/revoke/:pluginId    # Revoke OAuth token

// MCP Protocol
WS     /mcp                         # MCP WebSocket connection
```

### 3. Security Middleware

- Request validation and sanitization
- Rate limiting
- CORS configuration
- Authentication middleware for admin endpoints
- Audit logging for all credential operations

## Implementation Priorities

### Phase 1: MVP

1. Basic plugin loading and registry
2. Simple API key authentication
3. Express server with basic MCP endpoints
4. File-based encrypted credential storage
5. Example plugin (e.g., OpenAI API)

### Phase 2: OAuth Integration

1. OAuth flow implementation
2. Token management and refresh
3. Admin UI for credential management
4. Support for Google/Microsoft OAuth
5. Plugin hot-reloading

### Phase 3: Advanced Features

1. Plugin marketplace/discovery
2. Advanced sandboxing and security
3. Clustering and scalability
4. Cloud secrets integration (AWS/Azure)
5. Comprehensive audit logging

## Security Considerations

### Critical Security Requirements

- **Encryption**: All credentials encrypted at rest with AES-256-GCM
- **Isolation**: Plugins cannot access other plugins' credentials
- **Validation**: Strict input validation and sanitization
- **Audit**: Complete audit trail of credential access
- **Memory Safety**: Clear sensitive data from memory after use
- **Network Security**: TLS for all external communications

### OAuth Security

- PKCE implementation for public clients
- State parameter validation
- Redirect URI strict validation
- Scope minimization
- Automatic token rotation where supported

## Example Plugin Structure

Create example plugins demonstrating:

1. **API Key Plugin**: Simple REST API integration (e.g., OpenWeatherMap)
2. **OAuth Plugin**: Google Drive or GitHub integration
3. **Custom Auth Plugin**: JWT or custom authentication scheme

## Testing Requirements

- Unit tests for all core components
- Integration tests for OAuth flows
- Security testing for credential storage
- Plugin loading and lifecycle tests
- End-to-end MCP protocol tests

## Documentation

- README with setup instructions
- Plugin development guide
- API documentation
- Security best practices
- Deployment guide

## Technology Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Authentication**: Custom OAuth implementation
- **Encryption**: Node.js crypto module
- **Testing**: Jest or similar
- **Documentation**: JSDoc + markdown

Start with Phase 1 MVP focusing on the plugin registry, basic authentication, and a simple example plugin. Ensure the architecture supports the OAuth requirements from the beginning even if not fully implemented initially.
