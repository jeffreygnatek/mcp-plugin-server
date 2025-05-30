# Process-Based Plugin Architecture

## Overview

This document describes the refactored architecture that uses the official MCP SDK with isolated Node.js processes for each plugin.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Main MCP Server                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────── │
│  │ Plugin Discovery │  │ Process Manager │  │ MCP Aggregator│ │
│  └─────────────────┘  └─────────────────┘  └─────────────── │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
         ┌──────────┐    ┌──────────┐    ┌──────────┐
         │ Plugin A │    │ Plugin B │    │ Plugin C │
         │ Process  │    │ Process  │    │ Process  │
         │ (MCP SDK)│    │ (MCP SDK)│    │ (MCP SDK)│
         └──────────┘    └──────────┘    └──────────┘
```

## Benefits

### 🔒 **Process Isolation**

- Plugin crashes don't affect other plugins or main server
- Memory isolation prevents plugins from interfering with each other
- Individual plugin resource management and monitoring

### 🔄 **Hot Reloading**

- Restart individual plugins without stopping the server
- Deploy plugin updates independently
- Graceful plugin failure handling

### 📊 **Resource Management**

- Per-plugin CPU and memory monitoring
- Individual plugin scaling and resource limits
- Better debugging and profiling capabilities

### 🛡️ **Security**

- Plugins run in separate security contexts
- Reduced attack surface per process
- Easier to implement plugin sandboxing

## Communication Flow

```
Client Request → Main Server → Plugin Process → Main Server → Client Response
```

### Tool Execution Flow

1. Client calls `postgres.query` tool
2. Main server routes to postgres plugin process
3. Postgres process executes using official MCP SDK
4. Response bubbles back through main server to client

### Discovery Flow

1. Main server scans `plugins/` directory
2. For each plugin, spawns Node.js process with MCP SDK
3. Queries each process for capabilities (tools, resources, prompts)
4. Aggregates and namespaces all capabilities
5. Exposes unified interface to MCP clients

## Implementation Components

### 1. **Main Server** (`src/server.ts`)

- MCP protocol compliance using official SDK
- Plugin process lifecycle management
- Request routing and response aggregation
- Health monitoring and restart logic

### 2. **Process Manager** (`src/core/process-manager.ts`)

- Child process spawning and management
- IPC communication handling
- Process health monitoring
- Graceful shutdown coordination

### 3. **Plugin Wrapper** (`src/core/plugin-wrapper.ts`)

- Standardized plugin process entry point
- Official MCP SDK integration
- Plugin-to-main-server communication

### 4. **Individual Plugins** (`plugins/*/index.ts`)

- Each plugin becomes standalone MCP server
- Uses official `@modelcontextprotocol/sdk`
- Runs in isolated Node.js process

## Configuration

### Main Server Configuration

```json
{
  "server": {
    "name": "MCP Plugin Server",
    "version": "2.0.0",
    "port": 3000
  },
  "processes": {
    "maxRestarts": 3,
    "restartDelay": 1000,
    "healthCheckInterval": 30000
  }
}
```

### Plugin Configuration (per plugin)

```json
{
  "name": "postgres",
  "process": {
    "maxMemory": "512MB",
    "timeout": 30000,
    "restartPolicy": "on-failure"
  },
  "dependencies": ["pg"]
}
```

## Process Lifecycle

### Startup

1. Main server starts
2. Discovers plugins from workspace packages
3. Spawns child process for each enabled plugin
4. Establishes IPC communication channels
5. Queries plugin capabilities and builds aggregated tool list
6. Starts accepting MCP client connections

### Runtime

1. Health checks monitor plugin processes
2. Failed processes are automatically restarted
3. New plugins can be hot-loaded
4. Resource usage is monitored per process

### Shutdown

1. Graceful shutdown signal sent to all plugin processes
2. Wait for plugins to complete current operations
3. Force terminate if graceful shutdown times out
4. Clean up IPC channels and resources

## Migration Path

### Phase 1: Core Infrastructure

- Implement ProcessManager
- Create plugin wrapper using official SDK
- Basic IPC communication

### Phase 2: Plugin Migration

- Convert existing plugins to use official SDK
- Update plugin discovery to spawn processes
- Implement health monitoring

### Phase 3: Advanced Features

- Hot reloading
- Resource monitoring
- Performance optimization

## Development Workflow

### Creating New Plugins

```bash
# Generate plugin scaffold using official SDK
npm run plugin:create weather-api axios

# Plugin automatically uses official MCP SDK template
# Runs in isolated process when server starts
```

### Testing Plugins

```bash
# Test individual plugin in isolation
npm run plugin:test postgres

# Test all plugins
npm run plugins:test

# Test with MCP Inspector
npm run dev:inspect
```

### Monitoring

```bash
# View plugin process status
npm run plugins:status

# Monitor plugin resources
npm run plugins:monitor

# Restart specific plugin
npm run plugin:restart postgres
```
