# Plugin Workspaces Guide

This guide explains how to manage plugins as individual packages using npm workspaces in the MCP Plugin Server.

## 🏗️ **Architecture Overview**

Each plugin is now a separate npm workspace with its own `package.json`, allowing for:

- **Independent dependency management** - Each plugin manages its own dependencies
- **Isolated environments** - Plugins can use different versions of the same package
- **Shared dependencies** - Common packages are automatically deduplicated
- **Individual building/testing** - Each plugin can have its own build and test scripts
- **Version control** - Plugins can be versioned independently

## 📁 **File Structure**

```
mcp-plugin-server/
├── package.json              # Root workspace configuration
├── plugins/
│   ├── hello-world/
│   │   ├── package.json      # Plugin-specific dependencies
│   │   ├── plugin.json       # MCP plugin configuration
│   │   ├── index.js          # Plugin implementation
│   │   └── README.md
│   ├── postgres/
│   │   ├── package.json      # PostgreSQL-specific dependencies
│   │   ├── plugin.json
│   │   ├── index.ts
│   │   └── README.md
│   └── ...
└── scripts/
    └── create-plugin.js      # Plugin creation utility
```

## 🚀 **Creating New Plugins**

### Using the Plugin Generator

```bash
# Create a simple plugin
npm run plugin:create my-awesome-plugin

# Create a plugin with dependencies
npm run plugin:create weather-plugin axios @types/axios

# Create a database plugin
npm run plugin:create mongodb-plugin mongodb @types/mongodb
```

This will generate:

- `plugins/my-awesome-plugin/package.json` - Dependency management
- `plugins/my-awesome-plugin/plugin.json` - MCP configuration
- `plugins/my-awesome-plugin/index.ts` - TypeScript implementation template
- `plugins/my-awesome-plugin/README.md` - Documentation template

### Manual Plugin Creation

1. **Create Plugin Directory**

   ```bash
   mkdir plugins/my-plugin
   cd plugins/my-plugin
   ```

2. **Create package.json**

   ```json
   {
     "name": "@mcp-plugins/my-plugin",
     "version": "1.0.0",
     "description": "My awesome MCP plugin",
     "main": "index.ts",
     "private": true,
     "scripts": {
       "build": "tsc",
       "test": "jest",
       "lint": "eslint *.ts"
     },
     "keywords": ["mcp", "my-plugin", "plugin"],
     "author": "Your Name",
     "license": "MIT",
     "dependencies": {
       "axios": "^1.6.0"
     },
     "devDependencies": {
       "@types/node": "^20.10.0"
     },
     "peerDependencies": {
       "typescript": "^5.0.0"
     },
     "engines": {
       "node": ">=18.0.0"
     }
   }
   ```

3. **Create plugin.json**
   ```json
   {
     "name": "my-plugin",
     "version": "1.0.0",
     "description": "My awesome MCP plugin",
     "main": "index.ts",
     "dependencies": ["axios"]
   }
   ```

## 📦 **Dependency Management**

### Installing Dependencies

```bash
# Install all plugin dependencies
npm install

# Install dependencies for all plugins
npm run plugins:install

# Install a specific package for a plugin
cd plugins/my-plugin
npm install lodash
npm install --save-dev @types/lodash
```

### Dependency Types

1. **Plugin Dependencies** (`dependencies`)

   - Runtime dependencies required by the plugin
   - Example: `axios`, `pg`, `mongodb`

2. **Development Dependencies** (`devDependencies`)

   - Type definitions and development tools
   - Example: `@types/node`, `@types/pg`

3. **Peer Dependencies** (`peerDependencies`)
   - Dependencies provided by the host environment
   - Example: `typescript`, shared utilities

### Shared Dependencies

Workspaces automatically deduplicate common dependencies:

```
node_modules/
├── express/          # Shared by root and multiple plugins
├── typescript/       # Shared TypeScript installation
└── .pnpm/ or similar # Plugin-specific dependencies
```

## 🏗️ **Building and Testing**

### Individual Plugin Operations

```bash
# Build a specific plugin
cd plugins/postgres
npm run build

# Test a specific plugin
cd plugins/slack
npm test

# Lint a specific plugin
cd plugins/my-plugin
npm run lint
```

### Workspace-wide Operations

```bash
# Build all plugins that have a build script
npm run plugins:build

# Test all plugins that have a test script
npm run plugins:test

# Install dependencies for all plugins
npm run plugins:install

# Run a command in all workspaces
npm run test --workspaces --if-present
```

## 🔧 **Advanced Configuration**

### TypeScript Configuration

Each plugin can have its own `tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["*.ts", "src/**/*"],
  "exclude": ["dist", "node_modules"]
}
```

### Jest Configuration

Plugin-specific testing in `jest.config.js`:

```javascript
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>"],
  testMatch: ["**/__tests__/**/*.ts", "**/*.test.ts"],
  collectCoverageFrom: ["*.ts", "!*.d.ts"],
};
```

### ESLint Configuration

Plugin-specific linting in `.eslintrc.js`:

```javascript
module.exports = {
  extends: ["../../.eslintrc.js"],
  parserOptions: {
    project: "./tsconfig.json",
  },
  rules: {
    // Plugin-specific rules
  },
};
```

## 🔍 **Plugin Discovery**

The plugin manager automatically discovers plugins by:

1. **Scanning workspace packages** - Reads `package.json` workspaces
2. **Loading plugin.json** - MCP-specific configuration
3. **Resolving dependencies** - Ensures all dependencies are available
4. **Initializing plugins** - Calls the plugin's initialize method

### Plugin Loading Order

1. **Dependency resolution** - Plugins with fewer dependencies load first
2. **Explicit ordering** - Use `plugin.json` `loadAfter` field if needed
3. **Parallel loading** - Independent plugins load concurrently

## 🛠️ **Development Workflow**

### 1. Create Plugin

```bash
npm run plugin:create weather-api axios
```

### 2. Implement Plugin

```typescript
// plugins/weather-api/index.ts
import axios from "axios";

class WeatherApiPlugin {
  // ... implementation
}

module.exports = WeatherApiPlugin;
```

### 3. Add Dependencies

```bash
cd plugins/weather-api
npm install dotenv
npm install --save-dev @types/jest
```

### 4. Test Plugin

```bash
cd plugins/weather-api
npm test
```

### 5. Build and Deploy

```bash
npm run plugins:build
npm start
```

## 🔒 **Security Considerations**

### Dependency Isolation

- Each plugin's dependencies are isolated
- Conflicts between plugin dependencies are avoided
- Security vulnerabilities are contained to specific plugins

### Version Management

- Pin exact versions for critical dependencies
- Use range versions for non-critical packages
- Regular dependency auditing with `npm audit`

### Access Control

- Plugins have limited access to the host system
- Credentials are managed through the secure storage system
- Network access can be controlled per plugin

## 📊 **Monitoring and Debugging**

### Plugin Health Checks

```bash
# Check workspace status
npm list --workspaces

# Check for dependency issues
npm ls --workspaces

# Audit security vulnerabilities
npm audit --workspaces
```

### Debugging Plugin Issues

1. **Check plugin logs** - Each plugin has its own logger
2. **Verify dependencies** - Ensure all required packages are installed
3. **Test in isolation** - Run plugin tests individually
4. **Check workspace configuration** - Verify package.json setup

### Performance Monitoring

- Monitor memory usage per plugin
- Track plugin initialization times
- Monitor dependency loading overhead

## 🚀 **Best Practices**

### 1. **Naming Convention**

```json
{
  "name": "@mcp-plugins/plugin-name",
  "private": true
}
```

### 2. **Version Management**

```json
{
  "version": "1.0.0",
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### 3. **Dependency Specification**

```json
{
  "dependencies": {
    "package": "^1.0.0" // Range for libraries
  },
  "devDependencies": {
    "@types/package": "^1.0.0" // Type definitions
  },
  "peerDependencies": {
    "typescript": "^5.0.0" // Host-provided dependencies
  }
}
```

### 4. **Script Consistency**

```json
{
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "lint": "eslint *.ts",
    "clean": "rm -rf dist"
  }
}
```

## 🆘 **Troubleshooting**

### Common Issues

1. **Dependency Resolution Errors**

   ```bash
   npm install --workspaces --force
   ```

2. **TypeScript Compilation Issues**

   ```bash
   npm run build --workspace=plugins/problematic-plugin
   ```

3. **Plugin Loading Failures**

   - Check plugin.json format
   - Verify main file exists
   - Ensure dependencies are installed

4. **Workspace Configuration**
   ```bash
   # Verify workspace setup
   npm config get workspaces
   npm ls --workspaces
   ```

### Recovery Commands

```bash
# Clean all node_modules
rm -rf node_modules plugins/*/node_modules

# Reinstall everything
npm install

# Reset specific plugin
rm -rf plugins/my-plugin/node_modules
cd plugins/my-plugin && npm install
```

## 📚 **Examples**

Check the existing plugins for examples:

- **`plugins/hello-world/`** - Simple plugin with no dependencies
- **`plugins/postgres/`** - Database plugin with `pg` dependency
- **`plugins/slack/`** - API integration with `@slack/web-api`
- **`plugins/sequential-thinking/`** - Pure TypeScript plugin

Each demonstrates different aspects of the workspace system and dependency management.
